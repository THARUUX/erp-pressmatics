import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [finishings] = await pool.execute(`
            SELECT f.*, m.name as machine_name, m.speed as machine_speed_val, m.speed_unit as machine_speed_unit_val 
            FROM finishings f 
            LEFT JOIN machines m ON f.machine_id = m.id 
            ORDER BY f.name ASC
        `);

        // Fetch variants for all finishings
        const [variants] = await pool.execute('SELECT * FROM finishing_variants ORDER BY unit_cost ASC');

        // Map variants to finishings and resolve speed
        const result = finishings.map(f => {
            // Priority: If machine linked, use machine speed (unless we want override? User asked for manual speed).
            // Manual services (is_machine=0) use f.speed.
            // Machine services (is_machine=1) use m.speed (machine_speed_val).
            const isMachine = f.is_machine === 1;
            const effectiveSpeed = isMachine ? f.machine_speed_val : f.speed;
            const effectiveUnit = isMachine ? f.machine_speed_unit_val : f.speed_unit;

            return {
                ...f,
                speed: effectiveSpeed,
                speed_unit: effectiveUnit,
                variants: variants.filter(v => v.finishing_id === f.id)
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch finishings' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { name, unit_cost, is_machine, machine_id, cost_unit, variants, speed, speed_unit } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const [result] = await pool.execute(
            'INSERT INTO finishings (name, unit_cost, is_machine, machine_id, cost_unit, speed, speed_unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                name,
                parseFloat(unit_cost) || 0,
                is_machine ? 1 : 0,
                machine_id || null,
                cost_unit || 'Unit',
                speed ? parseFloat(speed) : null,
                speed_unit || 'Sheets/Hr'
            ]
        );

        const newId = result.insertId;

        // Insert Variants if any
        if (variants && Array.isArray(variants) && variants.length > 0) {
            for (const v of variants) {
                if (v.name) {
                    await pool.execute(
                        'INSERT INTO finishing_variants (finishing_id, name, unit_cost) VALUES (?, ?, ?)',
                        [newId, v.name, parseFloat(v.unit_cost) || 0]
                    );
                }
            }
        }

        return NextResponse.json({ id: newId, success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to add finishing' }, { status: 500 });
    }
}
