import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/invoices/[id]
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        const [rows] = await pool.execute(`
            SELECT i.*,
                (i.amount_due - i.amount_paid) AS balance,
                q.code AS quotation_code,
                c.email AS customer_email,
                c.phone AS customer_phone,
                c.address AS customer_address,
                c.is_vat AS customer_is_vat,
                c.vat_number AS customer_vat_number
            FROM invoices i
            LEFT JOIN quotations q ON i.quotation_id = q.id
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [id]);

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const [payments] = await pool.execute(
            'SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_at DESC',
            [id]
        );

        return NextResponse.json({ ...rows[0], payments });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PUT /api/invoices/[id]
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            customer_name, customer_id, description,
            amount_due, due_date, notes, status, quotation_id, invoice_notes
        } = body;

        await pool.execute(`
            UPDATE invoices SET
                customer_name = ?, customer_id = ?, description = ?,
                amount_due = ?, due_date = ?, notes = ?,
                status = ?, quotation_id = ?, invoice_notes = ?
            WHERE id = ?
        `, [
            customer_name, customer_id || null, description || '',
            parseFloat(amount_due) || 0, due_date || null, notes || '',
            status || 'draft', quotation_id || null, invoice_notes || null,
            id
        ]);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/invoices/[id]
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM invoices WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
