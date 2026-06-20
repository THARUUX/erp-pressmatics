import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/customers/[id]/profile
 * Returns full customer profile: info, stats, quotations, sales orders, invoices
 */
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // ── Customer ────────────────────────────────────────────────────────
        const [[customer]] = await pool.execute(
            'SELECT * FROM customers WHERE id = ?', [id]
        );
        if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // ── Quotations ──────────────────────────────────────────────────────
        const [quotations] = await pool.execute(`
            SELECT q.id, q.code, q.status, q.total_amount, q.quotation_date, q.created_at,
                (SELECT qi.estimation_name
                 FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = q.id ORDER BY qli.display_order ASC LIMIT 1
                ) AS first_item_name
            FROM quotations q
            WHERE q.customer_id = ?
            ORDER BY q.created_at DESC
            LIMIT 50
        `, [id]);

        // ── Invoices ────────────────────────────────────────────────────────
        const [invoices] = await pool.execute(`
            SELECT i.id, i.code, i.status, i.amount_due, i.amount_paid,
                   (i.amount_due - i.amount_paid) AS balance,
                   i.due_date, i.created_at, i.quotation_id,
                   q.code AS quotation_code
            FROM invoices i
            LEFT JOIN quotations q ON i.quotation_id = q.id
            WHERE i.customer_id = ?
            ORDER BY i.created_at DESC
            LIMIT 50
        `, [id]);

        // ── Sales Orders (via quotation customer_id) ─────────────────────
        const [salesOrders] = await pool.execute(`
            SELECT so.id, so.code, so.status, so.created_at, so.quotation_id,
                   q.code AS quotation_code, q.total_amount,
                   (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                    FROM quotation_items qi
                    JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                    WHERE qli.quotation_id = so.quotation_id) AS job_names
            FROM sales_orders so
            JOIN quotations q ON so.quotation_id = q.id
            WHERE q.customer_id = ?
            ORDER BY so.created_at DESC
            LIMIT 50
        `, [id]);

        // ── Aggregate Stats ─────────────────────────────────────────────────
        const [[invoiceStats]] = await pool.execute(`
            SELECT
                COALESCE(SUM(amount_paid), 0)                                               AS total_revenue,
                COALESCE(SUM(CASE WHEN status != 'paid' THEN amount_due - amount_paid ELSE 0 END), 0) AS outstanding,
                COALESCE(SUM(amount_due), 0)                                                AS total_billed,
                COUNT(*)                                                                     AS invoice_count,
                MAX(created_at)                                                              AS last_invoice_at
            FROM invoices
            WHERE customer_id = ?
        `, [id]);

        const [[quotationStats]] = await pool.execute(`
            SELECT
                COUNT(*)                                AS total_quotes,
                COALESCE(SUM(total_amount), 0)          AS total_quoted,
                COALESCE(AVG(total_amount), 0)          AS avg_job_value,
                COUNT(CASE WHEN status='converted' THEN 1 END) AS converted_count
            FROM quotations
            WHERE customer_id = ?
        `, [id]);

        return NextResponse.json({
            customer,
            quotations,
            invoices,
            salesOrders,
            stats: {
                ...invoiceStats,
                ...quotationStats,
                sales_order_count: salesOrders.length,
            },
        });
    } catch (error) {
        console.error('Customer profile error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
