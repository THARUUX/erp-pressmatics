import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const { name, unit_cost, is_machine, machine_id, cost_unit, variants, speed, speed_unit } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        await pool.execute(
            'UPDATE finishings SET name = ?, unit_cost = ?, is_machine = ?, machine_id = ?, cost_unit = ?, speed = ?, speed_unit = ? WHERE id = ?',
            [
                name,
                parseFloat(unit_cost) || 0,
                is_machine ? 1 : 0,
                machine_id || null,
                cost_unit || 'Unit',
                speed ? parseFloat(speed) : null,
                speed_unit || 'Sheets/Hr',
                id
            ]
        );

        // Update Variants: Delete existing and re-insert
        await pool.execute('DELETE FROM finishing_variants WHERE finishing_id = ?', [id]);

        if (variants && Array.isArray(variants) && variants.length > 0) {
            for (const v of variants) {
                if (v.name) {
                    await pool.execute(
                        'INSERT INTO finishing_variants (finishing_id, name, unit_cost) VALUES (?, ?, ?)',
                        [id, v.name, parseFloat(v.unit_cost) || 0]
                    );
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("error", error);
        return NextResponse.json({ error: 'Failed to update finishing' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM finishings WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        // Handle FK constraint violation if necessary
        return NextResponse.json({ error: 'Failed to delete finishing' }, { status: 500 });
    }
}
