import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    const conn = await pool.getConnection();
    try {
        const body = await req.json();
        const {
            itemId,
            action, // 'in' or 'out'
            quantity,
            reason, // 'employee' or 'other'
            subReason, // 'saved' or 'wasted' (only if reason === 'employee')
            employeeId,
            teamId,
            salesOrderId,
            notes
        } = body;

        if (!itemId || !action || !quantity) {
            conn.release();
            return NextResponse.json({ error: 'Item ID, Action, and Quantity are required' }, { status: 400 });
        }

        const qty = parseFloat(quantity);
        if (qty <= 0 || isNaN(qty)) {
            conn.release();
            return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 });
        }

        if (action !== 'in' && action !== 'out') {
            conn.release();
            return NextResponse.json({ error: 'Invalid action. Must be "in" or "out"' }, { status: 400 });
        }

        // Fetch current item details
        const [items] = await conn.execute(
            'SELECT name, stock_quantity, min_stock, category, unit_cost FROM inventory_items WHERE id = ?',
            [itemId]
        );

        if (items.length === 0) {
            conn.release();
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const item = items[0];
        const currentStock = parseFloat(item.stock_quantity || 0);
        const unitCost = parseFloat(item.unit_cost || 0);

        // Calculate new stock
        const changeQty = action === 'in' ? qty : -qty;
        const newStock = currentStock + changeQty;

        // If out, stock cannot go below zero
        if (newStock < 0) {
            conn.release();
            return NextResponse.json({ error: `Insufficient stock. Current stock is ${currentStock}` }, { status: 400 });
        }

        const minStock = parseFloat(item.min_stock || 0);
        const isActive = newStock >= minStock ? 1 : 0;

        await conn.beginTransaction();

        // 1. Update the parent inventory item
        await conn.execute(
            'UPDATE inventory_items SET stock_quantity = ?, is_active = ? WHERE id = ?',
            [newStock, isActive, itemId]
        );

        // 2. Insert into inventory_transactions
        const txnType = action === 'in' ? 'adjustment' : 'usage';
        let txNotes = notes || '';
        if (reason === 'employee' && subReason) {
            txNotes = `[Employee ${subReason.toUpperCase()}] ${txNotes}`.trim();
        }

        await conn.execute(
            'INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes) VALUES (?, ?, ?, ?)',
            [itemId, txnType, changeQty, txNotes || (action === 'in' ? 'Manual In Adjustment' : 'Manual Out Adjustment')]
        );

        // 3. Log employee action details if reason is employee
        if (reason === 'employee') {
            const actType = subReason === 'saved' ? 'saved' : 'wasted';
            await conn.execute(
                `INSERT INTO employee_stock_actions (employee_id, team_id, sales_order_id, inventory_item_id, action_type, quantity, unit_cost, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    employeeId || null,
                    teamId || null,
                    salesOrderId || null,
                    itemId,
                    actType,
                    qty,
                    unitCost,
                    notes || null
                ]
            );
        }

        // 4. If action is 'in' and parent is SF or FG, deduct BOM components (matches restock pattern)
        const isSfFg = item.category === 'SF' || item.category === 'FG';
        const bomWarnings = [];

        if (action === 'in' && isSfFg) {
            const [bomLines] = await conn.execute(
                `SELECT b.component_item_id, b.quantity AS bom_qty, b.notes AS bom_notes,
                        i.stock_quantity AS comp_stock, i.name AS comp_name, i.min_stock AS comp_min
                 FROM inventory_bom b
                 JOIN inventory_items i ON b.component_item_id = i.id
                 WHERE b.parent_item_id = ?`,
                [itemId]
            );

            for (const line of bomLines) {
                const deductQty = parseFloat(line.bom_qty) * qty;
                const newCompStock = parseFloat(line.comp_stock || 0) - deductQty;

                if (newCompStock < 0) {
                    bomWarnings.push(`${line.comp_name}: insufficient stock (need ${deductQty}, have ${line.comp_stock})`);
                }

                const compIsActive = newCompStock >= parseFloat(line.comp_min || 0) ? 1 : 0;

                await conn.execute(
                    'UPDATE inventory_items SET stock_quantity = ?, is_active = ? WHERE id = ?',
                    [Math.max(0, newCompStock), compIsActive, line.component_item_id]
                );

                await conn.execute(
                    'INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes) VALUES (?, ?, ?, ?)',
                    [
                        line.component_item_id,
                        'usage',
                        -deductQty,
                        `[BOM] Deducted for ${qty} unit(s) of parent #${itemId}${line.bom_notes ? '. ' + line.bom_notes : ''}`
                    ]
                );
            }
        }

        await conn.commit();
        conn.release();

        return NextResponse.json({
            success: true,
            newStock,
            isActive,
            bomWarnings
        });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('Stock Action Error:', error);
        return NextResponse.json({ error: 'Stock adjustment failed', details: error.message }, { status: 500 });
    }
}
