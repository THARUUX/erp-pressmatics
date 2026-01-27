import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute(
            'SELECT * FROM inventory_transactions WHERE inventory_item_id = ? ORDER BY created_at DESC',
            [id]
        );
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Fetch History Error:", error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
