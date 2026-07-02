import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [[po]] = await pool.execute(
            `SELECT po.*, s.name AS supplier_name, s.code AS supplier_code, s.payment_terms
             FROM purchase_orders po
             JOIN suppliers s ON s.id = po.supplier_id
             WHERE po.id = ?`,
            [id]
        );
        if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const [items] = await pool.execute(
            `SELECT poi.*, ii.name AS inv_item_name, ii.item_code, ii.stock_quantity AS current_stock
             FROM purchase_order_items poi
             LEFT JOIN inventory_items ii ON ii.id = poi.inventory_item_id
             WHERE poi.po_id = ?`,
            [id]
        );

        return NextResponse.json({ ...po, items });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to fetch purchase order' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, expected_date, notes } = body;

        await pool.execute(
            'UPDATE purchase_orders SET status=?, expected_date=?, notes=? WHERE id=?',
            [status, expected_date || null, notes || null, id]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const [[po]] = await pool.execute('SELECT status FROM purchase_orders WHERE id=?', [id]);
        if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (po.status === 'received') {
            return NextResponse.json({ error: 'Cannot delete a received purchase order' }, { status: 409 });
        }
        await pool.execute('DELETE FROM purchase_orders WHERE id=?', [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 });
    }
}
