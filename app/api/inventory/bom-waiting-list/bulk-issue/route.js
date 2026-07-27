import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { issuances } = body; // Array of { bom_id, sales_order_id, quantity }

        if (!Array.isArray(issuances) || issuances.length === 0) {
            return NextResponse.json({ error: 'No items to issue provided' }, { status: 400 });
        }

        const results = [];
        let successCount = 0;
        let failedCount = 0;

        for (const iss of issuances) {
            const { bom_id, sales_order_id, quantity } = iss;
            const qtyToIssue = parseFloat(quantity);

            if (!bom_id || !sales_order_id || isNaN(qtyToIssue) || qtyToIssue <= 0) {
                results.push({ bom_id, success: false, error: 'Invalid ID or quantity' });
                failedCount++;
                continue;
            }

            const conn = await pool.getConnection();
            try {
                // Fetch Sales Order Code & Customer Name
                const [orders] = await conn.execute('SELECT code, customer_name FROM sales_orders WHERE id = ?', [sales_order_id]);
                if (orders.length === 0) {
                    throw new Error('Sales order not found');
                }
                const soCode = orders[0].code;
                const customerName = orders[0].customer_name || 'N/A';

                // Fetch BOM line
                const [bomLines] = await conn.execute('SELECT * FROM sales_order_bom WHERE id = ? AND sales_order_id = ?', [bom_id, sales_order_id]);
                if (bomLines.length === 0) {
                    throw new Error('BOM line not found');
                }

                const bomLine = bomLines[0];
                const remainingNeeded = Math.max(0, parseFloat(bomLine.required_qty) - parseFloat(bomLine.issued_qty));

                if (qtyToIssue > remainingNeeded) {
                    throw new Error(`Cannot issue more than the remaining required quantity of ${remainingNeeded}`);
                }

                // Check current inventory availability
                const [invItems] = await conn.execute('SELECT stock_quantity FROM inventory_items WHERE id = ?', [bomLine.inventory_item_id]);
                if (invItems.length === 0) {
                    throw new Error('Inventory item not found');
                }

                const available = parseFloat(invItems[0].stock_quantity || 0);
                if (qtyToIssue > available) {
                    throw new Error(`Insufficient stock in inventory. Available: ${available}, Requested: ${qtyToIssue}`);
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
                        `BOM Issue: ${bomLine.component_name} (${bomLine.component_type}) for Sales Order ${soCode} (${customerName}) (Bulk)`
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
                results.push({ bom_id, success: true, issuedQty: qtyToIssue });
                successCount++;
            } catch (err) {
                await conn.rollback();
                results.push({ bom_id, success: false, error: err.message });
                failedCount++;
            } finally {
                conn.release();
            }
        }

        return NextResponse.json({
            success: true,
            successCount,
            failedCount,
            results
        });

    } catch (error) {
        console.error("Bulk Issue BOM Stock Error:", error);
        return NextResponse.json({ error: 'Failed to process bulk issuance', details: error.message }, { status: 500 });
    }
}
