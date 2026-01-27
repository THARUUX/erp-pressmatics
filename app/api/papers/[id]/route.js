import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, type, cost_per_sheet, stock_quantity } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        await pool.execute(
            'UPDATE papers SET name = ?, type = ?, cost_per_sheet = ?, stock_quantity = ? WHERE id = ?',
            [name, type, parseFloat(cost_per_sheet) || 0, parseInt(stock_quantity) || 0, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update Paper Error:', error);
        return NextResponse.json({ error: 'Failed to update paper' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM papers WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Paper Error:', error);
        return NextResponse.json({ error: 'Failed to delete paper' }, { status: 500 });
    }
}
