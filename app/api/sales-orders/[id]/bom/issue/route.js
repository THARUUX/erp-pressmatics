import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req, { params }) {
    const { id: sales_order_id } = await params;
    const conn = await pool.getConnection();
    try {
        const body = await req.json();
        const { bom_id, quantity } = body;

        const qtyToIssue = parseFloat(quantity);
        if (!bom_id || isNaN(qtyToIssue) || qtyToIssue <= 0) {
            conn.release();
            return NextResponse.json({ error: 'Valid BOM ID and positive quantity are required' }, { status: 400 });
        }

        // Fetch Sales Order Code & Customer Name
        const [orders] = await conn.execute('SELECT code, customer_name FROM sales_orders WHERE id = ?', [sales_order_id]);
        if (orders.length === 0) {
            conn.release();
            return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
        }
        const soCode = orders[0].code;
        const customerName = orders[0].customer_name || 'N/A';

        // Fetch BOM line
        const [bomLines] = await conn.execute('SELECT * FROM sales_order_bom WHERE id = ? AND sales_order_id = ?', [bom_id, sales_order_id]);
        if (bomLines.length === 0) {
            conn.release();
            return NextResponse.json({ error: 'BOM line not found' }, { status: 404 });
        }

        const bomLine = bomLines[0];
        const remainingNeeded = Math.max(0, parseFloat(bomLine.required_qty) - parseFloat(bomLine.issued_qty));

        if (qtyToIssue > remainingNeeded) {
            conn.release();
            return NextResponse.json({ error: `Cannot issue more than the remaining required quantity of ${remainingNeeded}` }, { status: 400 });
        }

        // Check current inventory availability
        const [invItems] = await conn.execute('SELECT stock_quantity FROM inventory_items WHERE id = ?', [bomLine.inventory_item_id]);
        if (invItems.length === 0) {
            conn.release();
            return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
        }

        const available = parseFloat(invItems[0].stock_quantity || 0);
        if (qtyToIssue > available) {
            conn.release();
            return NextResponse.json({ error: `Insufficient stock in inventory. Available: ${available}, Requested: ${qtyToIssue}` }, { status: 400 });
        }

        await conn.beginTransaction();

        // 1. Deduct stock from inventory
        await conn.execute(
            `UPDATE inventory_items
             SET stock_quantity = stock_quantity - ?
             WHERE id = ?`,
            [qtyToIssue, bomLine.inventory_item_id]
        );

        // 2. Log in inventory_transactions
        await conn.execute(
            `INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes)
             VALUES (?, 'issue_note', ?, ?)`,
            [
                bomLine.inventory_item_id,
                -qtyToIssue,
                `BOM Issue: ${bomLine.component_name} (${bomLine.component_type}) for Sales Order ${soCode} (${customerName})`
            ]
        );

        // 3. Update issued_qty in sales_order_bom
        await conn.execute(
            `UPDATE sales_order_bom
             SET issued_qty = issued_qty + ?
             WHERE id = ?`,
            [qtyToIssue, bom_id]
        );

        await conn.commit();
        conn.release();

        return NextResponse.json({ success: true, issuedQty: qtyToIssue });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error("Issue BOM Stock Error:", error);
        return NextResponse.json({ error: 'Failed to issue stock', details: error.message }, { status: 500 });
    }
}
