import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, category, type, unit_cost, stock_quantity, item_code, uom } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        await pool.execute(
            'UPDATE inventory_items SET name = ?, category = ?, type = ?, unit_cost = ?, stock_quantity = ?, item_code = ?, uom = ?, min_stock = ? WHERE id = ?',
            [name, category, type, parseFloat(unit_cost) || 0, parseInt(stock_quantity) || 0, item_code || null, uom || 'Unit', parseInt(body.min_stock) || 0, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update Inventory Error:', error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM inventory_items WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Inventory Error:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return NextResponse.json({ error: 'Cannot delete: Item is in use.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}
