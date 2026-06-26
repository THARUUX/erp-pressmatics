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

        const invoice = rows[0];

        // ── Pull aggregated data from linked quotation items as fallbacks ──────────
        // Only if this invoice has a quotation_id and is missing qty/tax data
        let quotationData = null;
        if (invoice.quotation_id) {
            const [qItems] = await pool.execute(`
                SELECT
                    SUM(qi.quantity)         AS total_qty,
                    SUM(qi.subtotal_amount)  AS total_subtotal,
                    SUM(qi.tax_amount)       AS total_tax,
                    SUM(qi.total_amount)     AS total_amount,
                    MAX(qi.tax_percentage)   AS tax_percentage,
                    MAX(qi.tax_mode)         AS tax_mode
                FROM quotation_items qi
                JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                WHERE qli.quotation_id = ?
            `, [invoice.quotation_id]);

            if (qItems.length > 0 && qItems[0].total_qty != null) {
                const q = qItems[0];
                const totalQty    = parseFloat(q.total_qty)    || 0;
                const totalAmount = parseFloat(q.total_amount) || 0;
                quotationData = {
                    qty_from_quotation:        totalQty,
                    unit_price_from_quotation: totalQty > 0 ? q.total_subtotal / totalQty : null,
                    subtotal_from_quotation:   parseFloat(q.total_subtotal) || null,
                    tax_amount_from_quotation: parseFloat(q.total_tax)      || null,
                    tax_percentage_from_quotation: parseFloat(q.tax_percentage) || null,
                    tax_mode_from_quotation:   q.tax_mode || null,
                };
            }
        }

        const [payments] = await pool.execute(
            'SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_at DESC',
            [id]
        );

        return NextResponse.json({ ...invoice, ...quotationData, payments });
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
            amount_due, due_date, notes, status, quotation_id, invoice_notes,
            qty, unit_price,
            subtotal_amount, tax_amount, tax_percentage
        } = body;

        await pool.execute(`
            UPDATE invoices SET
                customer_name = ?, customer_id = ?, description = ?,
                amount_due = ?, due_date = ?, notes = ?,
                status = ?, quotation_id = ?, invoice_notes = ?,
                qty = ?, unit_price = ?,
                subtotal_amount = ?, tax_amount = ?, tax_percentage = ?
            WHERE id = ?
        `, [
            customer_name, customer_id || null, description || '',
            parseFloat(amount_due) || 0, due_date || null, notes || '',
            status || 'draft', quotation_id || null, invoice_notes || null,
            qty          != null ? parseFloat(qty)          : null,
            unit_price   != null ? parseFloat(unit_price)   : null,
            subtotal_amount  != null ? parseFloat(subtotal_amount)  : null,
            tax_amount       != null ? parseFloat(tax_amount)       : null,
            tax_percentage   != null ? parseFloat(tax_percentage)   : null,
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
