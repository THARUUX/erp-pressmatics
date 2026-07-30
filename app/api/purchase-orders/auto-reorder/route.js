import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { orders = [] } = await req.json();

        if (!orders.length) {
            return NextResponse.json({ error: 'No orders provided' }, { status: 400 });
        }

        const createdPOs = [];

        for (const order of orders) {
            const { supplier_id, items = [] } = order;
            if (!supplier_id || !items.length) {
                continue;
            }

            // Get current sequence
            const [seqRows] = await connection.execute(
                "SELECT setting_value FROM settings WHERE setting_key = 'po_number_seq' FOR UPDATE"
            );
            let seq = seqRows.length > 0 ? parseInt(seqRows[0].setting_value || '1') : 1;
            const [tmplRows] = await connection.execute(
                "SELECT setting_value FROM settings WHERE setting_key = 'po_number_template'"
            );
            const template = tmplRows.length > 0 ? tmplRows[0].setting_value : 'PO-{0000}';
            const po_number = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

            // Calc totals
            const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.unit_price) * parseFloat(it.quantity)), 0);
            const total_amount = subtotal;

            const orderDate = new Date().toISOString().split('T')[0];

            const [result] = await connection.execute(
                `INSERT INTO purchase_orders
                    (po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, notes)
                 VALUES (?, ?, ?, NULL, 'draft', ?, 0, ?, 'Auto-generated from low stock reorder')`,
                [po_number, supplier_id, orderDate, subtotal, total_amount]
            );
            const poId = result.insertId;

            // Insert line items
            for (const it of items) {
                const lineTotal = parseFloat(it.unit_price) * parseFloat(it.quantity);
                await connection.execute(
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
            await connection.execute(
                "UPDATE settings SET setting_value = ? WHERE setting_key = 'po_number_seq'",
                [String(seq + 1)]
            );

            createdPOs.push({ id: poId, po_number });
        }

        await connection.commit();
        return NextResponse.json({ success: true, createdPOs });
    } catch (err) {
        await connection.rollback();
        console.error('Auto-reorder POST error:', err);
        return NextResponse.json({ error: 'Failed to create auto-reorder POs', details: err.message }, { status: 500 });
    } finally {
        connection.release();
    }
}
