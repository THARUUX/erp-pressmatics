import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST /api/invoices/[id]/payments  — record a payment
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const { amount, method, reference, paid_at, notes } = await req.json();

        // Insert payment
        await pool.execute(`
            INSERT INTO invoice_payments (invoice_id, amount, method, reference, paid_at, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, parseFloat(amount), method || 'Cash', reference || '', paid_at, notes || '']);

        // Recalculate total paid
        const [[{ total_paid }]] = await pool.execute(
            'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM invoice_payments WHERE invoice_id = ?',
            [id]
        );

        // Determine new status
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
