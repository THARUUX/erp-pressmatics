import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    const conn = await pool.getConnection();
    try {
        const body = await req.json();
        const { itemId, quantity, notes } = body;

        if (!itemId || !quantity) {
            conn.release();
            return NextResponse.json({ error: 'Item ID and Quantity are required' }, { status: 400 });
        }

        const qty = parseFloat(quantity);
        if (qty <= 0) {
            conn.release();
            return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 });
        }

        // 1. Fetch current item info
        const [items] = await conn.execute(
            'SELECT stock_quantity, min_stock, category FROM inventory_items WHERE id = ?',
            [itemId]
        );
        if (items.length === 0) {
            conn.release();
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const currentItem = items[0];
        const newStock = parseFloat(currentItem.stock_quantity || 0) + qty;
        const minStock = parseFloat(currentItem.min_stock || 0);
        const isActive = newStock >= minStock ? 1 : 0;

        await conn.beginTransaction();

        // 2. Update SF/FG Item stock
        await conn.execute(
            'UPDATE inventory_items SET stock_quantity = ?, is_active = ? WHERE id = ?',
            [newStock, isActive, itemId]
        );

        // 3. Log restock transaction for the SF/FG item
        await conn.execute(
            'INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes) VALUES (?, ?, ?, ?)',
            [itemId, 'issue_note', qty, notes || 'Restock']
        );

        // 4. If SF or FG: deduct BOM components
        const isSfFg = currentItem.category === 'SF' || currentItem.category === 'FG';
        const bomWarnings = [];

        if (isSfFg) {
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

                // Log deduction transaction for the component
                // Using 'issue_note' because inventory_transactions.type is an ENUM
                // The notes field clarifies it's a BOM deduction
                await conn.execute(
                    'INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes) VALUES (?, ?, ?, ?)',
                    [
                        line.component_item_id,
                        'issue_note',
                        -deductQty,
                        `[BOM] Deducted for ${qty} unit(s) of item #${itemId}${line.bom_notes ? '. ' + line.bom_notes : ''}`
                    ]
                );
            }
        }

        await conn.commit();
        return NextResponse.json({ success: true, newStock, isActive, bomWarnings });
    } catch (error) {
        await conn.rollback();
        console.error('Restock Error:', error);
        return NextResponse.json({ error: 'Restock failed' }, { status: 500 });
    } finally {
        conn.release();
    }
}
