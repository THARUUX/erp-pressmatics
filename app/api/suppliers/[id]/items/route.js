import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute(
            `SELECT si.*, ii.name AS inventory_item_name, ii.item_code, ii.stock_quantity, ii.uom AS inventory_uom
             FROM supplier_items si
             LEFT JOIN inventory_items ii ON ii.id = si.inventory_item_id
             WHERE si.supplier_id = ?
             ORDER BY si.item_name ASC`,
            [id]
        );
        return NextResponse.json(rows);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to fetch supplier items' }, { status: 500 });
    }
}

export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { inventory_item_id, item_name, sku, unit_price, uom, min_order_qty, lead_time_days, notes } = body;

        if (!item_name) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });

        const [result] = await pool.execute(
            `INSERT INTO supplier_items
                (supplier_id, inventory_item_id, item_name, sku, unit_price, uom, min_order_qty, lead_time_days, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                inventory_item_id || null,
                item_name,
                sku || null,
                parseFloat(unit_price) || 0,
                uom || 'Unit',
                parseFloat(min_order_qty) || 1,
                parseInt(lead_time_days) || 0,
                notes || null,
            ]
        );
        return NextResponse.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to create supplier item' }, { status: 500 });
    }
}
