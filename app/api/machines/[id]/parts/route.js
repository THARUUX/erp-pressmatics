import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req, { params }) {
    try {
        const resolvedParams = await params;
        const machineId = resolvedParams.id;
        const body = await req.json();
        const { part_name, limit_run_quantity, limit_hours } = body;

        if (!part_name) {
            return NextResponse.json({ error: 'Part name is required' }, { status: 400 });
        }

        const limitQty = limit_run_quantity ? parseFloat(limit_run_quantity) : null;
        const limitHrs = limit_hours ? parseFloat(limit_hours) : null;

        const [result] = await pool.execute(`
            INSERT INTO machine_parts (
                machine_id, part_name, limit_run_quantity, balance_run_quantity, limit_hours, balance_hours
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [machineId, part_name, limitQty, limitQty, limitHrs, limitHrs]);

        const [newPart] = await pool.execute('SELECT * FROM machine_parts WHERE id = ?', [result.insertId]);

        return NextResponse.json(newPart[0] || { success: true });
    } catch (err) {
        console.error('Add machine part error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
