import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/portal/[token]
 * Public endpoint — look up customer by portal_token and return all relevant data.
 * Never exposes internal customer ID.
 */
export async function GET(req, { params }) {
    try {
        const { token } = await params;
        if (!token || token.length < 32) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        // Resolve customer from token (never select id directly to public)
        const [[customer]] = await pool.execute(
            `SELECT id, name, email, phone, address, category, is_vat, vat_number,
                    contact_name, contact_role, contact_email, contact_phone, created_at
             FROM customers WHERE portal_token = ?`,
            [token]
        );
        if (!customer) {
            return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
        }

        const customerId = customer.id;
        // Don't expose the internal ID in the response
        delete customer.id;

        // ── Quotations ─────────────────────────────────────────────────────
        const [quotations] = await pool.execute(`
            SELECT q.code, q.status, q.total_amount, q.quotation_date,
                (SELECT qi.estimation_name
                 FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = q.id ORDER BY qli.display_order ASC LIMIT 1
                ) AS first_item_name
            FROM quotations q
            WHERE q.customer_id = ? OR (q.customer_id IS NULL AND q.customer_name = ?)
            ORDER BY q.created_at DESC
            LIMIT 30
        `, [customerId, customer.name]);

        // ── Invoices ───────────────────────────────────────────────────────
        const [invoices] = await pool.execute(`
            SELECT i.code, i.status, i.amount_due, i.amount_paid,
                   (i.amount_due - i.amount_paid) AS balance,
                   i.due_date, i.created_at,
                   q.code AS quotation_code
            FROM invoices i
            LEFT JOIN quotations q ON i.quotation_id = q.id
            WHERE i.customer_id = ? OR (i.customer_id IS NULL AND i.customer_name = ?)
            ORDER BY i.created_at DESC
            LIMIT 50
        `, [customerId, customer.name]);

        // ── Sales Orders ───────────────────────────────────────────────────
        const [salesOrders] = await pool.execute(`
            SELECT so.id AS order_id, so.code, so.status, so.delivery_date, so.created_at,
                   q.code AS quotation_code, q.total_amount,
                   (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                    FROM quotation_items qi
                    JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                    WHERE qli.quotation_id = so.quotation_id) AS job_names
            FROM sales_orders so
            JOIN quotations q ON so.quotation_id = q.id
            WHERE q.customer_id = ? OR (q.customer_id IS NULL AND so.customer_name = ?)
            ORDER BY so.created_at DESC
            LIMIT 30
        `, [customerId, customer.name]);

        // ── Stats ──────────────────────────────────────────────────────────
        const [[invStats]] = await pool.execute(`
            SELECT
                COALESCE(SUM(amount_paid), 0) AS total_paid,
                COALESCE(SUM(amount_due), 0)  AS total_billed,
                COALESCE(SUM(CASE WHEN status != 'paid' THEN amount_due - amount_paid ELSE 0 END), 0) AS outstanding,
                COUNT(*) AS invoice_count
            FROM invoices 
            WHERE customer_id = ? OR (customer_id IS NULL AND customer_name = ?)
        `, [customerId, customer.name]);

        const [[qStats]] = await pool.execute(`
            SELECT COUNT(*) AS total_quotes,
                   COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted_count
            FROM quotations 
            WHERE customer_id = ? OR (customer_id IS NULL AND customer_name = ?)
        `, [customerId, customer.name]);

        // ── Company Branding ───────────────────────────────────────────────
        const [settingRows] = await pool.execute(
            `SELECT setting_key, setting_value FROM settings
             WHERE setting_key IN ('company_name','company_logo','company_address','company_tagline','company_phone','company_email')`
        );
        const brand = {};
        settingRows.forEach(r => { brand[r.setting_key] = r.setting_value; });

        return NextResponse.json({
            customer,
            quotations,
            invoices,
            salesOrders,
            stats: {
                ...invStats,
                ...qStats,
                sales_order_count: salesOrders.length,
            },
            brand,
        });
    } catch (err) {
        console.error('[portal GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
