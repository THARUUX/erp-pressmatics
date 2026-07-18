import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function syncAndGetConfigs() {
    const [machines] = await pool.execute('SELECT id, name, type FROM machines');
    const [finishings] = await pool.execute('SELECT id, name FROM finishings');

    // Clean up unwanted configurations (generic print/finishing and finishing machines)
    const keysToDelete = ['offset_printing', 'digital_printing', 'finishing'];
    for (const m of machines) {
        if (m.type === 'finishing') {
            keysToDelete.push(`machine_${m.id}`);
        }
    }
    await pool.execute(
        `DELETE FROM task_configurations WHERE task_key IN (${keysToDelete.map(() => '?').join(',')})`,
        keysToDelete
    );

    // Fetch the active configurations
    const [configs] = await pool.execute('SELECT * FROM task_configurations');
    const configMap = new Map(configs.map(c => [c.task_key, c]));
    const missing = [];

    // Check machines (excluding prepress CTP machines since they fall under plate making, and finishing machines since they fall under finishings)
    for (const m of machines) {
        if (m.type === 'finishing' || m.type === 'prepress') continue;
        const key = `machine_${m.id}`;
        if (!configMap.has(key)) {
            missing.push({
                task_key: key,
                name: m.name,
                description: `Machine task: ${m.name}`,
                display_order: m.type === 'offset' ? 40 : 50,
                is_bb_separated: m.type === 'offset' ? 1 : 0,
                estimated_minutes: null,
                is_enabled: 1
            });
        }
    }

    // Check finishings
    for (const f of finishings) {
        const key = `finishing_${f.id}`;
        if (!configMap.has(key)) {
            missing.push({
                task_key: key,
                name: f.name,
                description: `Finishing task: ${f.name}`,
                display_order: 60,
                is_bb_separated: 0,
                estimated_minutes: null,
                is_enabled: 1
            });
        }
    }

    if (missing.length > 0) {
        for (const item of missing) {
            await pool.execute(
                `INSERT INTO task_configurations (task_key, name, description, display_order, is_bb_separated, estimated_minutes, is_enabled)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [item.task_key, item.name, item.description, item.display_order, item.is_bb_separated, item.estimated_minutes, item.is_enabled]
            );
        }
    }

    // Refetch sorted
    const [allRows] = await pool.execute('SELECT * FROM task_configurations ORDER BY display_order ASC');
    return allRows;
}

export async function GET() {
    try {
        const configs = await syncAndGetConfigs();
        const [machines] = await pool.execute('SELECT id, name, type FROM machines ORDER BY name ASC');
        return NextResponse.json({ configs, machines });
    } catch (error) {
        console.error('Error fetching task configs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { configs } = body;

        if (!Array.isArray(configs)) {
            return NextResponse.json({ error: 'configs array is required' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Get existing configs
            const [existing] = await connection.execute('SELECT id FROM task_configurations');
            const existingIds = existing.map(row => row.id);
            const keepIds = configs.filter(c => c.id).map(c => c.id);
            const toDelete = existingIds.filter(id => !keepIds.includes(id));

            if (toDelete.length > 0) {
                const placeholders = toDelete.map(() => '?').join(',');
                await connection.execute(`DELETE FROM task_configurations WHERE id IN (${placeholders})`, toDelete);
            }

            for (const c of configs) {
                const machineIdVal = c.machine_id !== null && c.machine_id !== undefined && c.machine_id !== '' ? parseInt(c.machine_id) : null;
                if (c.id) {
                    await connection.execute(
                        `UPDATE task_configurations 
                         SET task_key = ?, name = ?, description = ?, display_order = ?, is_bb_separated = ?, estimated_minutes = ?, is_enabled = ?, machine_id = ?
                         WHERE id = ?`,
                        [
                            c.task_key || 'custom',
                            c.name,
                            c.description || null,
                            parseInt(c.display_order) || 0,
                            c.is_bb_separated ? 1 : 0,
                            c.estimated_minutes !== null && c.estimated_minutes !== undefined && c.estimated_minutes !== '' ? parseInt(c.estimated_minutes) : null,
                            c.is_enabled ? 1 : 0,
                            machineIdVal,
                            c.id
                        ]
                    );
                } else {
                    await connection.execute(
                        `INSERT INTO task_configurations (task_key, name, description, display_order, is_bb_separated, estimated_minutes, is_enabled, machine_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            c.task_key || 'custom',
                            c.name,
                            c.description || null,
                            parseInt(c.display_order) || 0,
                            c.is_bb_separated ? 1 : 0,
                            c.estimated_minutes !== null && c.estimated_minutes !== undefined && c.estimated_minutes !== '' ? parseInt(c.estimated_minutes) : null,
                            c.is_enabled ? 1 : 0,
                            machineIdVal
                        ]
                    );
                }
            }

            await connection.commit();
            return NextResponse.json({ success: true });
        } catch (err) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error saving task configs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
