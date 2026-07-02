import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id, itemId } = await params;
        const body = await req.json();
        const { inventory_item_id, item_name, sku, unit_price, uom, min_order_qty, lead_time_days, notes, is_active } = body;

        await pool.execute(
            `UPDATE supplier_items SET
                inventory_item_id=?, item_name=?, sku=?, unit_price=?, uom=?,
                min_order_qty=?, lead_time_days=?, notes=?, is_active=?
             WHERE id=? AND supplier_id=?`,
            [
                inventory_item_id || null,
                item_name,
                sku || null,
                parseFloat(unit_price) || 0,
                uom || 'Unit',
                parseFloat(min_order_qty) || 1,
                parseInt(lead_time_days) || 0,
                notes || null,
                is_active !== undefined ? (is_active ? 1 : 0) : 1,
                itemId, id,
            ]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to update supplier item' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id, itemId } = await params;
        await pool.execute('DELETE FROM supplier_items WHERE id=? AND supplier_id=?', [itemId, id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to delete supplier item' }, { status: 500 });
    }
}
