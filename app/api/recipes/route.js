import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function initTables() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS product_recipes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recipe_code VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(100) DEFAULT 'General',
            status VARCHAR(50) DEFAULT 'Draft',
            yield_quantity INT DEFAULT 1,
            target_margin_pct DECIMAL(10,2) DEFAULT 30.00,
            target_selling_price DECIMAL(12,2) DEFAULT 0.00,
            overhead_cost DECIMAL(12,2) DEFAULT 0.00,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS recipe_materials (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recipe_id INT NOT NULL,
            inventory_item_id INT DEFAULT NULL,
            material_name VARCHAR(255) NOT NULL,
            quantity DECIMAL(12,4) DEFAULT 1.0000,
            uom VARCHAR(50) DEFAULT 'Unit',
            unit_cost DECIMAL(12,2) DEFAULT 0.00,
            wastage_pct DECIMAL(10,2) DEFAULT 0.00,
            total_cost DECIMAL(12,2) DEFAULT 0.00,
            notes VARCHAR(255) DEFAULT NULL,
            FOREIGN KEY (recipe_id) REFERENCES product_recipes(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS recipe_steps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recipe_id INT NOT NULL,
            step_number INT DEFAULT 1,
            step_name VARCHAR(255) NOT NULL,
            work_center VARCHAR(100) DEFAULT 'General',
            labor_hours DECIMAL(10,2) DEFAULT 0.00,
            hourly_rate DECIMAL(12,2) DEFAULT 0.00,
            setup_cost DECIMAL(12,2) DEFAULT 0.00,
            instructions TEXT DEFAULT NULL,
            total_cost DECIMAL(12,2) DEFAULT 0.00,
            FOREIGN KEY (recipe_id) REFERENCES product_recipes(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
}

export async function GET(req) {
    try {
        await initTables();

        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const category = searchParams.get('category') || '';
        const status = searchParams.get('status') || '';

        let query = `
            SELECT 
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
                ) AS unit_cost,
                (SELECT COUNT(*) FROM recipe_materials rm WHERE rm.recipe_id = pr.id) AS materials_count,
                (SELECT COUNT(*) FROM recipe_steps rs WHERE rs.recipe_id = pr.id) AS steps_count
            FROM product_recipes pr
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (pr.name LIKE ? OR pr.recipe_code LIKE ? OR pr.description LIKE ?)`;
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        if (category) {
            query += ` AND pr.category = ?`;
            params.push(category);
        }

        if (status) {
            query += ` AND pr.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY pr.id DESC`;

        const [recipes] = await pool.execute(query, params);

        return NextResponse.json({ success: true, recipes });
    } catch (error) {
        console.error('GET /api/recipes error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch product recipes' }, { status: 500 });
    }
}

export async function POST(req) {
    const connection = await pool.getConnection();
    try {
        await initTables();

        const body = await req.json();
        const {
            name,
            category = 'General',
            status = 'Draft',
            yield_quantity = 1,
            target_margin_pct = 30,
            target_selling_price = 0,
            overhead_cost = 0,
            description = '',
            materials = [],
            steps = [],
        } = body;

        if (!name || name.trim() === '') {
            return NextResponse.json({ error: 'Recipe Name is required' }, { status: 400 });
        }

        await connection.beginTransaction();

        // Generate unique Recipe Code (e.g. REC-0001)
        const [seqResult] = await connection.execute(`SELECT COUNT(*) AS total FROM product_recipes`);
        const nextSeq = (seqResult[0].total || 0) + 1;
        const recipe_code = `REC-${String(nextSeq).padStart(4, '0')}`;

        const [res] = await connection.execute(
            `INSERT INTO product_recipes (recipe_code, name, category, status, yield_quantity, target_margin_pct, target_selling_price, overhead_cost, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                recipe_code,
                name.trim(),
                category,
                status,
                parseInt(yield_quantity) || 1,
                parseFloat(target_margin_pct) || 0,
                parseFloat(target_selling_price) || 0,
                parseFloat(overhead_cost) || 0,
                description || null,
            ]
        );

        const recipeId = res.insertId;

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
                        recipeId,
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
                        recipeId,
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

        return NextResponse.json({ success: true, id: recipeId, recipe_code });
    } catch (error) {
        await connection.rollback();
        console.error('POST /api/recipes error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create product recipe' }, { status: 500 });
    } finally {
        connection.release();
    }
}
