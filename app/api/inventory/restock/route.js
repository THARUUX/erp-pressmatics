import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { itemId, quantity, notes } = body;

        if (!itemId || !quantity) {
            return NextResponse.json({ error: 'Item ID and Quantity are required' }, { status: 400 });
        }

        const qty = parseFloat(quantity);
        if (qty <= 0) return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 });

        // 1. Fetch current item info
        const [items] = await pool.execute('SELECT stock_quantity, min_stock FROM inventory_items WHERE id = ?', [itemId]);
        if (items.length === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

        const currentItem = items[0];
        const newStock = parseFloat(currentItem.stock_quantity || 0) + qty;
        const minStock = parseFloat(currentItem.min_stock || 0);

        // 2. Determine active status
        // Reactivate if stock >= min_stock
        // If it was already active, it stays active.
        let isActive = 1;
        if (newStock < minStock) {
            isActive = 0; // Still below min stock? Actually requirement says "less than min stock -> deactivated".
            // So if newStock >= minStock, it should be active.
        }

        // 3. Update Item
        await pool.execute(
            'UPDATE inventory_items SET stock_quantity = ?, is_active = ? WHERE id = ?',
            [newStock, isActive, itemId]
        );

        // 4. Log Transaction
        await pool.execute(
            'INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes) VALUES (?, ?, ?, ?)',
            [itemId, 'issue_note', qty, notes || 'Restock']
        );

        return NextResponse.json({ success: true, newStock, isActive });
    } catch (error) {
        console.error("Restock Error:", error);
        return NextResponse.json({ error: 'Restock failed' }, { status: 500 });
    }
}
