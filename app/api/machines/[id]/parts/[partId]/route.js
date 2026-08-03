import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(req, { params }) {
    try {
        const resolvedParams = await params;
        const { partId } = resolvedParams;

        await pool.execute(`
            DELETE FROM machine_parts
            WHERE id = ?
        `, [partId]);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Delete part error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
