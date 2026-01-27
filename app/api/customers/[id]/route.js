import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);
        if (rows.length === 0) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        return NextResponse.json(rows[0]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, email, phone, address } = body;

        await pool.execute(
            'UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
            [name, email || null, phone || null, address || null, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        // FK constraint might fail if used
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }
}
