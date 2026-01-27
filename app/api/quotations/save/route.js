import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            customer_name,
            customer_id,
            selected_item_ids = [] // Array of item IDs
        } = body;

        if (!customer_name || selected_item_ids.length === 0) {
            return NextResponse.json({ error: 'Missing customer name or items' }, { status: 400 });
        }

        // 1. Calculate Total Amount from selected items
        // We fetch the amounts from the DB to ensure accuracy
        const placeholders = selected_item_ids.map(() => '?').join(',');
        const [items] = await pool.execute(
            `SELECT id, total_amount FROM quotation_items WHERE id IN (${placeholders})`,
            selected_item_ids
        );

        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.total_amount), 0);

        // Generate Quotation Code
        const [settings] = await pool.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('quotation_id_template', 'quotation_id_seq')");
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let seq = parseInt(settingsMap['quotation_id_seq'] || '1');
        let template = settingsMap['quotation_id_template'] || 'QTN-{0000}';

        const code = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // Use first item description or generic
        const jobDescription = items.length > 0 ? items[0].job_description + (items.length > 1 ? ` (+${items.length - 1} others)` : '') : 'New Quotation';

        // 2. Insert Quotation Header
        const [result] = await pool.execute(
            `INSERT INTO quotations (customer_name, customer_id, total_amount, job_description, code, quotation_date, status) VALUES (?, ?, ?, ?, ?, NOW(), 'draft')`,
            [customer_name, customer_id || null, totalAmount, jobDescription, code]
        );
        const quotationId = result.insertId;

        // Increment Seq
        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'quotation_id_seq'", [String(seq + 1)]);

        // 3. Link Items
        let displayOrder = 1;
        for (const itemId of selected_item_ids) {
            await pool.execute(
                `INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order)
                 VALUES (?, ?, ?)`,
                [quotationId, itemId, displayOrder++]
            );

            // Optional: Update status
            await pool.execute(
                `UPDATE quotation_items SET status = 'linked' WHERE id = ?`,
                [itemId]
            );
        }

        return NextResponse.json({ success: true, quotationId });

    } catch (error) {
        console.error("Save Quotation Container Error:", error);
        return NextResponse.json({ error: 'Failed to save quotation', details: error.message }, { status: 500 });
    }
}
