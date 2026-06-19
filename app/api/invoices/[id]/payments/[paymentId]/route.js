import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/invoices/[id]/payments/[paymentId]
export async function GET(req, { params }) {
    try {
        const { id, paymentId } = await params;
        const [rows] = await pool.execute(`
            SELECT p.*,
                i.code        AS invoice_code,
                i.customer_name,
                i.customer_id,
                i.amount_due,
                i.amount_paid,
                i.description AS invoice_description,
                i.quotation_id,
                c.address     AS customer_address,
                c.phone       AS customer_phone,
                c.email       AS customer_email,
                c.vat_number  AS customer_vat_number,
                c.is_vat      AS customer_is_vat,
                q.code        AS quotation_code
            FROM invoice_payments p
            JOIN invoices i       ON p.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN quotations q ON i.quotation_id = q.id
            WHERE p.id = ? AND p.invoice_id = ?
        `, [paymentId, id]);

        if (rows.length === 0) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        return NextResponse.json(rows[0]);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/invoices/[id]/payments/[paymentId]
export async function DELETE(req, { params }) {
    try {
        const { id, paymentId } = await params;

        await pool.execute('DELETE FROM invoice_payments WHERE id = ? AND invoice_id = ?', [paymentId, id]);

        // Recalculate
        const [[{ total_paid }]] = await pool.execute(
            'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM invoice_payments WHERE invoice_id = ?',
            [id]
        );
        const [[inv]] = await pool.execute('SELECT amount_due, due_date FROM invoices WHERE id = ?', [id]);
        const due  = parseFloat(inv.amount_due);
        const paid = parseFloat(total_paid);

        let newStatus = 'sent';
        if (paid >= due) {
            newStatus = 'paid';
        } else if (paid > 0) {
            newStatus = 'partial';
        } else if (inv.due_date && new Date(inv.due_date) < new Date()) {
            newStatus = 'overdue';
        }

        await pool.execute(
            'UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?',
            [paid, newStatus, id]
        );

        return NextResponse.json({ success: true, amount_paid: paid, status: newStatus });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
