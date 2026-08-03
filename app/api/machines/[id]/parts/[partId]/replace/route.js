import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req, { params }) {
    try {
        const resolvedParams = await params;
        const { partId } = resolvedParams;

        await pool.execute(`
            UPDATE machine_parts
            SET balance_run_quantity = limit_run_quantity,
                balance_hours = limit_hours,
                last_changed_at = NOW()
            WHERE id = ?
        `, [partId]);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Replace part error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
