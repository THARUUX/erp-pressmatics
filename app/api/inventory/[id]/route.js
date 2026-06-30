import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute('SELECT * FROM inventory_items WHERE id = ?', [id]);
        if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(rows[0]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, category, type, unit_cost, stock_quantity, item_code, uom, description, is_active } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        await pool.execute(
            'UPDATE inventory_items SET name = ?, category = ?, type = ?, unit_cost = ?, stock_quantity = ?, item_code = ?, uom = ?, min_stock = ?, width_cm = ?, height_cm = ?, description = ?, is_active = ? WHERE id = ?',
            [name, category, type, parseFloat(unit_cost) || 0, parseInt(stock_quantity) || 0, item_code || null, uom || 'Unit', parseInt(body.min_stock) || 0, parseFloat(body.width_cm) || null, parseFloat(body.height_cm) || null, description || null, is_active != null ? (is_active ? 1 : 0) : 1, id]
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
