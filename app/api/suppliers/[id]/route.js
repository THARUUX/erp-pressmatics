import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute('SELECT * FROM suppliers WHERE id = ?', [id]);
        if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(rows[0]);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            name, email, phone, address,
            contact_name, contact_phone, contact_email,
            payment_terms, credit_limit, notes, is_active, starting_outstanding,
        } = body;

        await pool.execute(
            `UPDATE suppliers SET
                name=?, email=?, phone=?, address=?,
                contact_name=?, contact_phone=?, contact_email=?,
                payment_terms=?, credit_limit=?, notes=?, is_active=?, starting_outstanding=?
             WHERE id=?`,
            [
                name, email || null, phone || null, address || null,
                contact_name || null, contact_phone || null, contact_email || null,
                payment_terms || 'Net 30',
                parseFloat(credit_limit) || 0,
                notes || null,
                is_active !== undefined ? (is_active ? 1 : 0) : 1,
                parseFloat(starting_outstanding) || 0,
                id,
            ]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        // Check for existing POs
        const [pos] = await pool.execute(
            "SELECT id FROM purchase_orders WHERE supplier_id = ? LIMIT 1", [id]
        );
        if (pos.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete supplier with existing purchase orders' },
                { status: 409 }
            );
        }
        await pool.execute('DELETE FROM suppliers WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
    }
}
