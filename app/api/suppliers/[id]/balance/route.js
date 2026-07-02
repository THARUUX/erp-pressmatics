import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Total purchased (all POs)
        const [[totals]] = await pool.execute(
            `SELECT
                COALESCE(SUM(total_amount), 0) AS total_purchased,
                COALESCE(SUM(paid_amount),  0) AS total_paid
             FROM purchase_orders
             WHERE supplier_id = ? AND status != 'cancelled'`,
            [id]
        );

        const outstanding = parseFloat(totals.total_purchased) - parseFloat(totals.total_paid);

        return NextResponse.json({
            total_purchased: parseFloat(totals.total_purchased),
            total_paid:      parseFloat(totals.total_paid),
            outstanding:     outstanding,
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to compute balance' }, { status: 500 });
    }
}
