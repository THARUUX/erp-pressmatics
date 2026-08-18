import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        const [recipes] = await pool.execute(
            `SELECT 
                pr.*,
                COALESCE((SELECT SUM(rm.total_cost) FROM recipe_materials rm WHERE rm.recipe_id = pr.id), 0) AS total_material_cost,
                COALESCE((SELECT SUM(rs.total_cost) FROM recipe_steps rs WHERE rs.recipe_id = pr.id), 0) AS total_labor_cost,
                (
                    COALESCE((SELECT SUM(rm.total_cost) FROM recipe_materials rm WHERE rm.recipe_id = pr.id), 0) +
                    COALESCE((SELECT SUM(rs.total_cost) FROM recipe_steps rs WHERE rs.recipe_id = pr.id), 0) +
                    COALESCE(pr.overhead_cost, 0)
                ) AS total_batch_cost,
                (
                    (
                        COALESCE((SELECT SUM(rm.total_cost) FROM recipe_materials rm WHERE rm.recipe_id = pr.id), 0) +
                        COALESCE((SELECT SUM(rs.total_cost) FROM recipe_steps rs WHERE rs.recipe_id = pr.id), 0) +
                        COALESCE(pr.overhead_cost, 0)
                    ) / GREATEST(COALESCE(pr.yield_quantity, 1), 1)
                ) AS unit_cost
            FROM product_recipes pr
            WHERE pr.id = ?`,
            [id]
        );

        if (recipes.length === 0) {
            return NextResponse.json({ error: 'Product Recipe not found' }, { status: 404 });
        }

        const recipe = recipes[0];

        const [materials] = await pool.execute(
            `SELECT * FROM recipe_materials WHERE recipe_id = ? ORDER BY id ASC`,
            [id]
        );

        const [steps] = await pool.execute(
            `SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number ASC, id ASC`,
            [id]
        );

        return NextResponse.json({
            success: true,
            recipe,
            materials,
            steps,
        });
    } catch (error) {
        console.error('GET /api/recipes/[id] error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch recipe' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    const connection = await pool.getConnection();
    try {
        const { id } = await params;
        const body = await req.json();

        const {
            name,
            category,
            status,
            yield_quantity,
            target_margin_pct,
            target_selling_price,
            overhead_cost,
            description,
            materials = [],
            steps = [],
        } = body;

        await connection.beginTransaction();

        await connection.execute(
            `UPDATE product_recipes 
             SET name = ?, category = ?, status = ?, yield_quantity = ?, target_margin_pct = ?, target_selling_price = ?, overhead_cost = ?, description = ?
             WHERE id = ?`,
            [
                name,
                category || 'General',
                status || 'Draft',
                parseInt(yield_quantity) || 1,
                parseFloat(target_margin_pct) || 0,
                parseFloat(target_selling_price) || 0,
                parseFloat(overhead_cost) || 0,
                description || null,
                id,
            ]
        );

        // Delete existing materials and steps, then re-insert
        await connection.execute(`DELETE FROM recipe_materials WHERE recipe_id = ?`, [id]);
        await connection.execute(`DELETE FROM recipe_steps WHERE recipe_id = ?`, [id]);

        // Insert Materials
        if (Array.isArray(materials) && materials.length > 0) {
            for (const mat of materials) {
                if (!mat.material_name || mat.material_name.trim() === '') continue;

                const qty = parseFloat(mat.quantity) || 0;
                const unitCost = parseFloat(mat.unit_cost) || 0;
                const wastage = parseFloat(mat.wastage_pct) || 0;
                const totalCost = (qty * unitCost) * (1 + wastage / 100);

                await connection.execute(
                    `INSERT INTO recipe_materials (recipe_id, inventory_item_id, material_name, quantity, uom, unit_cost, wastage_pct, total_cost, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        mat.inventory_item_id || null,
                        mat.material_name.trim(),
                        qty,
                        mat.uom || 'Unit',
                        unitCost,
                        wastage,
                        totalCost,
                        mat.notes || null,
                    ]
                );
            }
        }

        // Insert Process Steps
        if (Array.isArray(steps) && steps.length > 0) {
            for (let idx = 0; idx < steps.length; idx++) {
                const step = steps[idx];
                if (!step.step_name || step.step_name.trim() === '') continue;

                const laborHours = parseFloat(step.labor_hours) || 0;
                const hourlyRate = parseFloat(step.hourly_rate) || 0;
                const setupCost = parseFloat(step.setup_cost) || 0;
                const totalStepCost = (laborHours * hourlyRate) + setupCost;

                await connection.execute(
                    `INSERT INTO recipe_steps (recipe_id, step_number, step_name, work_center, labor_hours, hourly_rate, setup_cost, instructions, total_cost)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        step.step_number || (idx + 1),
                        step.step_name.trim(),
                        step.work_center || 'General',
                        laborHours,
                        hourlyRate,
                        setupCost,
                        step.instructions || null,
                        totalStepCost,
                    ]
                );
            }
        }

        await connection.commit();

        return NextResponse.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('PUT /api/recipes/[id] error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update recipe' }, { status: 500 });
    } finally {
        connection.release();
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute(`DELETE FROM product_recipes WHERE id = ?`, [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/recipes/[id] error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete recipe' }, { status: 500 });
    }
}
