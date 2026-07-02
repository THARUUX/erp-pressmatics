import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute(
            `SELECT sp.*, po.po_number
             FROM supplier_payments sp
             LEFT JOIN purchase_orders po ON po.id = sp.po_id
             WHERE sp.supplier_id = ?
             ORDER BY sp.payment_date DESC, sp.created_at DESC`,
            [id]
        );
        return NextResponse.json(rows);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}

export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { po_id, payment_date, amount, method, reference, notes } = body;

        if (!payment_date || !amount) {
            return NextResponse.json({ error: 'Date and amount are required' }, { status: 400 });
        }

        const [result] = await pool.execute(
            `INSERT INTO supplier_payments (supplier_id, po_id, payment_date, amount, method, reference, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                po_id || null,
                payment_date,
                parseFloat(amount),
                method || 'bank_transfer',
                reference || null,
                notes || null,
            ]
        );

        // Update the PO's paid_amount if linked
        if (po_id) {
            await pool.execute(
                `UPDATE purchase_orders
                 SET paid_amount = (
                     SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE po_id = ?
                 )
                 WHERE id = ?`,
                [po_id, po_id]
            );
        }

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }
}
