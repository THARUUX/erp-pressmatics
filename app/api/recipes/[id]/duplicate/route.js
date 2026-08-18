import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req, { params }) {
    const connection = await pool.getConnection();
    try {
        const { id } = await params;

        // Fetch original recipe
        const [recipes] = await connection.execute(
            `SELECT * FROM product_recipes WHERE id = ?`,
            [id]
        );

        if (recipes.length === 0) {
            return NextResponse.json({ error: 'Source product recipe not found' }, { status: 404 });
        }

        const original = recipes[0];

        // Fetch original materials and steps
        const [materials] = await connection.execute(
            `SELECT * FROM recipe_materials WHERE recipe_id = ?`,
            [id]
        );

        const [steps] = await connection.execute(
            `SELECT * FROM recipe_steps WHERE recipe_id = ?`,
            [id]
        );

        await connection.beginTransaction();

        // Generate new recipe code
        const [seqResult] = await connection.execute(`SELECT COUNT(*) AS total FROM product_recipes`);
        const nextSeq = (seqResult[0].total || 0) + 1;
        const new_recipe_code = `REC-${String(nextSeq).padStart(4, '0')}`;
        const new_name = `${original.name} (Copy)`;

        const [res] = await connection.execute(
            `INSERT INTO product_recipes (recipe_code, name, category, status, yield_quantity, target_margin_pct, target_selling_price, overhead_cost, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                new_recipe_code,
                new_name,
                original.category,
                'Draft',
                original.yield_quantity,
                original.target_margin_pct,
                original.target_selling_price,
                original.overhead_cost,
                original.description,
            ]
        );

        const newRecipeId = res.insertId;

        // Copy Materials
        for (const mat of materials) {
            await connection.execute(
                `INSERT INTO recipe_materials (recipe_id, inventory_item_id, material_name, quantity, uom, unit_cost, wastage_pct, total_cost, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newRecipeId,
                    mat.inventory_item_id,
                    mat.material_name,
                    mat.quantity,
                    mat.uom,
                    mat.unit_cost,
                    mat.wastage_pct,
                    mat.total_cost,
                    mat.notes,
                ]
            );
        }

        // Copy Steps
        for (const step of steps) {
            await connection.execute(
                `INSERT INTO recipe_steps (recipe_id, step_number, step_name, work_center, labor_hours, hourly_rate, setup_cost, instructions, total_cost)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newRecipeId,
                    step.step_number,
                    step.step_name,
                    step.work_center,
                    step.labor_hours,
                    step.hourly_rate,
                    step.setup_cost,
                    step.instructions,
                    step.total_cost,
                ]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            id: newRecipeId,
            recipe_code: new_recipe_code,
            name: new_name,
        });
    } catch (error) {
        await connection.rollback();
        console.error('POST /api/recipes/[id]/duplicate error:', error);
        return NextResponse.json({ error: error.message || 'Failed to duplicate recipe' }, { status: 500 });
    } finally {
        connection.release();
    }
}
