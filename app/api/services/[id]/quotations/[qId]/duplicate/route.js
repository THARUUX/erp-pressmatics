import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST /api/services/[id]/quotations/[qId]/duplicate
export async function POST(request, { params }) {
    try {
        const { id, qId } = await params;

        // 1. Fetch original quotation
        const [quotes] = await pool.execute(
            'SELECT * FROM quotations WHERE id = ? AND service_id = ?',
            [qId, id]
        );

        if (quotes.length === 0) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }

        const orig = quotes[0];

        // 2. Fetch quotation line items
        const [items] = await pool.execute(
            `SELECT qi.* 
             FROM quotation_line_items qli
             JOIN quotation_items qi ON qli.quotation_item_id = qi.id
             WHERE qli.quotation_id = ?
             ORDER BY qli.display_order ASC`,
            [qId]
        );

        // 3. Generate new sequential quotation code
        const [settings] = await pool.execute(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('quotation_id_template', 'quotation_id_seq')"
        );
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let seq = parseInt(settingsMap['quotation_id_seq'] || '1');
        let template = settingsMap['quotation_id_template'] || 'QTN-{0000}';
        const newCode = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // 4. Insert duplicated quotation header
        const [quoteResult] = await pool.execute(
            `INSERT INTO quotations (customer_name, customer_id, total_amount, job_description, code, quotation_date, status, service_id, terms_and_conditions, show_grand_total, show_signature)
             VALUES (?, ?, ?, ?, ?, NOW(), 'approved', ?, ?, ?, ?)`,
            [
                orig.customer_name,
                orig.customer_id || null,
                orig.total_amount,
                orig.job_description || null,
                newCode,
                id,
                orig.terms_and_conditions || null,
                orig.show_grand_total ?? 1,
                orig.show_signature ?? 1
            ]
        );

        const newQuotationId = quoteResult.insertId;

        // Increment sequence
        await pool.execute(
            "UPDATE settings SET setting_value = ? WHERE setting_key = 'quotation_id_seq'",
            [String(seq + 1)]
        );

        // 5. Duplicate items
        let displayOrder = 1;
        for (const item of items) {
            const [itemResult] = await pool.execute(
                `INSERT INTO quotation_items (code, estimation_name, customer_name, item_name, job_description, type, quantity, total_amount, subtotal_amount, status, customer_id, tax_mode, tax_percentage, tax_amount)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newCode,
                    item.estimation_name || item.item_name,
                    item.customer_name || orig.customer_name,
                    item.item_name,
                    item.job_description || item.item_name,
                    item.type || 'services',
                    item.quantity || 1,
                    item.total_amount || 0,
                    item.subtotal_amount || item.total_amount || 0,
                    'linked',
                    item.customer_id || orig.customer_id || null,
                    item.tax_mode || 'none',
                    item.tax_percentage || 0,
                    item.tax_amount || 0
                ]
            );

            const newItemId = itemResult.insertId;

            await pool.execute(
                `INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order)
                 VALUES (?, ?, ?)`,
                [newQuotationId, newItemId, displayOrder++]
            );
        }

        return NextResponse.json({
            success: true,
            quotationId: newQuotationId,
            code: newCode,
            message: `Quotation duplicated successfully as ${newCode}`
        });
    } catch (error) {
        console.error('POST /api/services/[id]/quotations/[qId]/duplicate error:', error);
        return NextResponse.json({ error: error.message || 'Failed to duplicate quotation' }, { status: 500 });
    }
}
