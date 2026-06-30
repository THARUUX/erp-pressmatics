import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Public endpoint — no auth required — used by QR scan page
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute(
            "SELECT id, name, item_code, category, type, unit_cost, uom, is_active, description FROM inventory_items WHERE id = ? AND category = 'Statics'",
            [id]
        );
        if (rows.length === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error('Statics QR fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
    }
}
