import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req, { params }) {
    try {
        const { id } = await params; // Original Quotation ID

        // 1. Fetch Original Quotation
        const [originalQuotes] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [id]);
        if (originalQuotes.length === 0) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }
        const originalQuote = originalQuotes[0];

        // 2. Generate New Quotation Code
        const [settings] = await pool.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('quotation_id_template', 'quotation_id_seq')");
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let qSeq = parseInt(settingsMap['quotation_id_seq'] || '1');
        let qTemplate = settingsMap['quotation_id_template'] || 'QTN-{0000}';

        const newQuoteCode = qTemplate.replace('{0000}', String(qSeq).padStart(4, '0')).replace('{SEQ}', String(qSeq));

        // Create New Quotation
        // Defaulting status to 'draft' and update dates
        const [newQuoteResult] = await pool.execute(
            'INSERT INTO quotations (customer_id, customer_name, quotation_date, status, total_amount, job_description, code) VALUES (?, ?, NOW(), ?, ?, ?, ?)',
            [originalQuote.customer_id, originalQuote.customer_name, 'draft', originalQuote.total_amount, `Copy of ${originalQuote.job_description || 'Quotation'}`, newQuoteCode]
        );
        const newQuoteId = newQuoteResult.insertId;

        // Increment Q Seq
        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'quotation_id_seq'", [String(qSeq + 1)]);

        // 3. Fetch Linked Items from Original
        const [lineItems] = await pool.execute(
            'SELECT quotation_item_id, display_order FROM quotation_line_items WHERE quotation_id = ? ORDER BY display_order ASC',
            [id]
        );

        // 4. Duplicate Each Item
        for (const line of lineItems) {
            const oldItemId = line.quotation_item_id;

            // Fetch Old Item
            const [items] = await pool.execute('SELECT * FROM quotation_items WHERE id = ?', [oldItemId]);
            if (items.length === 0) continue;
            const oldItem = items[0];

            // Generate New Code
            const [settings] = await pool.execute("SELECT setting_value FROM settings WHERE setting_key = 'item_code_seq'");
            let seq = 1000;
            if (settings.length > 0) seq = parseInt(settings[0].setting_value);

            const [templateSettings] = await pool.execute("SELECT setting_value FROM settings WHERE setting_key = 'item_code_template'");
            let template = 'INV-{0000}';
            if (templateSettings.length > 0) template = templateSettings[0].setting_value;

            const newCode = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

            // Create New Item
            // Prepare data, EXCLUDING id and code (use newCode) and created_at (let DB handle or set NOW)
            const { id: _, code: __, created_at: ___, updated_at: ____, ...itemData } = oldItem;

            // Inject new code
            itemData.code = newCode;
            itemData.created_at = new Date().toISOString().slice(0, 19).replace('T', ' '); // format for MySQL

            const columns = Object.keys(itemData).join(', ');
            const placeholders = Object.keys(itemData).map(() => '?').join(', ');
            const values = Object.values(itemData);

            const [newItemResult] = await pool.execute(
                `INSERT INTO quotation_items (${columns}) VALUES (${placeholders})`,
                values
            );
            const newItemId = newItemResult.insertId;

            // Increment Seq
            await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'item_code_seq'", [String(seq + 1)]);

            // Duplicate Details
            const [details] = await pool.execute('SELECT * FROM quotation_item_details WHERE quotation_item_id = ?', [oldItemId]);
            for (const detail of details) {
                const { id: __, quotation_item_id: ___, ...detailData } = detail;
                const dCols = Object.keys(detailData).join(', ');
                const dPlaceholders = Object.keys(detailData).map(() => '?').join(', ');
                const dValues = Object.values(detailData);

                await pool.execute(
                    `INSERT INTO quotation_item_details (quotation_item_id, ${dCols}) VALUES (?, ${dPlaceholders})`,
                    [newItemId, ...dValues]
                );
            }

            // Duplicate Finishings
            const [finishings] = await pool.execute('SELECT * FROM quotation_item_finishings WHERE quotation_item_id = ?', [oldItemId]);
            for (const finishing of finishings) {
                const { id: __, quotation_item_id: ___, ...finData } = finishing;
                const fCols = Object.keys(finData).join(', ');
                const fPlaceholders = Object.keys(finData).map(() => '?').join(', ');
                const fValues = Object.values(finData);

                await pool.execute(
                    `INSERT INTO quotation_item_finishings (quotation_item_id, ${fCols}) VALUES (?, ${fPlaceholders})`,
                    [newItemId, ...fValues]
                );
            }

            // Link New Item to New Quotation
            await pool.execute(
                'INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order) VALUES (?, ?, ?)',
                [newQuoteId, newItemId, line.display_order]
            );
        }

        return NextResponse.json({ success: true, newId: newQuoteId });

    } catch (error) {
        console.error("Duplicate Quotation Error:", error);
        return NextResponse.json({ error: 'Failed to duplicate quotation' }, { status: 500 });
    }
}
