import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const supplierId = searchParams.get('supplier_id');
        const status     = searchParams.get('status');

        let query = `
            SELECT po.*, s.name AS supplier_name, s.code AS supplier_code
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE 1=1
        `;
        const params = [];

        if (supplierId) { query += ' AND po.supplier_id = ?'; params.push(supplierId); }
        if (status)     { query += ' AND po.status = ?';      params.push(status); }

        query += ' ORDER BY po.created_at DESC';

        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { supplier_id, order_date, expected_date, notes, items = [] } = body;

        if (!supplier_id || !order_date) {
            return NextResponse.json({ error: 'Supplier and order date required' }, { status: 400 });
        }
        if (!items.length) {
            return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
        }

        // Generate PO number
        const [seqRows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'po_number_seq'"
        );
        let seq = seqRows.length > 0 ? parseInt(seqRows[0].setting_value || '1') : 1;
        const [tmplRows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'po_number_template'"
        );
        const template = tmplRows.length > 0 ? tmplRows[0].setting_value : 'PO-{0000}';
        const po_number = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // Calc totals
        const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.unit_price) * parseFloat(it.quantity)), 0);
        const tax_amount   = parseFloat(body.tax_amount) || 0;
        const total_amount = subtotal + tax_amount;

        const [result] = await pool.execute(
            `INSERT INTO purchase_orders
                (po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, notes)
             VALUES (?, ?, ?, ?, 'ordered', ?, ?, ?, ?)`,
            [po_number, supplier_id, order_date, expected_date || null, subtotal, tax_amount, total_amount, notes || null]
        );
        const poId = result.insertId;

        // Insert line items
        for (const it of items) {
            const lineTotal = parseFloat(it.unit_price) * parseFloat(it.quantity);
            await pool.execute(
                `INSERT INTO purchase_order_items
                    (po_id, supplier_item_id, inventory_item_id, item_name, quantity, unit_price, total_price, uom)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    poId,
                    it.supplier_item_id || null,
                    it.inventory_item_id || null,
                    it.item_name,
                    parseFloat(it.quantity),
                    parseFloat(it.unit_price),
                    lineTotal,
                    it.uom || 'Unit',
                ]
            );
        }

        // Advance sequence
        await pool.execute(
            "UPDATE settings SET setting_value = ? WHERE setting_key = 'po_number_seq'",
            [String(seq + 1)]
        );

        return NextResponse.json({ success: true, id: poId, po_number });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
    }
}
