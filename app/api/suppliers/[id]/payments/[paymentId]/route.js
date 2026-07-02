import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(req, { params }) {
    try {
        const { id, paymentId } = await params;

        // Get the payment to check the po_id before deleting
        const [[payment]] = await pool.execute(
            'SELECT * FROM supplier_payments WHERE id=? AND supplier_id=?',
            [paymentId, id]
        );
        if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

        await pool.execute(
            'DELETE FROM supplier_payments WHERE id=? AND supplier_id=?',
            [paymentId, id]
        );

        // Recalculate paid_amount on linked PO if any
        if (payment.po_id) {
            await pool.execute(
                `UPDATE purchase_orders
                 SET paid_amount = (
                     SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE po_id = ?
                 )
                 WHERE id = ?`,
                [payment.po_id, payment.po_id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
    }
}
