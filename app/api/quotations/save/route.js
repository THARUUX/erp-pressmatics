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

        const { ignore_stock_warning = false } = body;

        // ── STOCK SHORTAGE WARNING CHECK ──────────────────────────────────────
        if (!ignore_stock_warning) {
            const placeholders = selected_item_ids.map(() => '?').join(',');

            // 1. Paper needs
            const [paperNeeds] = await pool.execute(`
                SELECT qid.paper_id AS inventory_item_id,
                       ii.name AS item_name,
                       SUM(qid.full_sheets_used) AS qty_needed,
                       ii.stock_quantity AS available
                FROM quotation_item_details qid
                JOIN inventory_items ii ON ii.id = qid.paper_id
                WHERE qid.quotation_item_id IN (${placeholders})
                  AND qid.paper_id IS NOT NULL
                  AND qid.full_sheets_used > 0
                GROUP BY qid.paper_id, ii.name, ii.stock_quantity
            `, selected_item_ids);

            // 2. Plate needs
            const [plateNeeds] = await pool.execute(`
                SELECT m.plate_id AS inventory_item_id,
                       ii.name AS item_name,
                       SUM(qid.plate_count) AS qty_needed,
                       ii.stock_quantity AS available
                FROM quotation_item_details qid
                JOIN machines m ON m.id = qid.machine_id
                JOIN inventory_items ii ON ii.id = m.plate_id
                WHERE qid.quotation_item_id IN (${placeholders})
                  AND qid.plate_count > 0
                  AND m.plate_id IS NOT NULL
                GROUP BY m.plate_id, ii.name, ii.stock_quantity
            `, selected_item_ids);

            // 3. SFG needs
            const [sfgNeeds] = await pool.execute(`
                SELECT sl.inventory_item_id,
                       ii.name AS item_name,
                       SUM(sl.quantity) AS qty_needed,
                       ii.stock_quantity AS available
                FROM quotation_item_sfg_lines sl
                JOIN quotation_item_details qid ON qid.id = sl.quotation_item_detail_id
                JOIN inventory_items ii ON ii.id = sl.inventory_item_id
                WHERE qid.quotation_item_id IN (${placeholders})
                  AND sl.is_statics = 0
                GROUP BY sl.inventory_item_id, ii.name, ii.stock_quantity
            `, selected_item_ids);

            // 4. Statics needs
            const [staticsNeeds] = await pool.execute(`
                SELECT sl.inventory_item_id,
                       ii.name AS item_name,
                       SUM(sl.quantity) AS qty_needed,
                       ii.stock_quantity AS available
                FROM quotation_item_sfg_lines sl
                JOIN quotation_item_details qid ON qid.id = sl.quotation_item_detail_id
                JOIN inventory_items ii ON ii.id = sl.inventory_item_id
                WHERE qid.quotation_item_id IN (${placeholders})
                  AND sl.is_statics = 1
                GROUP BY sl.inventory_item_id, ii.name, ii.stock_quantity
            `, selected_item_ids);

            const shortages = [];
            const checkItem = (row, type) => {
                const required = Math.ceil(parseFloat(row.qty_needed || 0));
                const available = parseFloat(row.available || 0);
                if (required > available) {
                    shortages.push({
                        type,
                        name: row.item_name,
                        required,
                        available,
                        shortfall: required - available
                    });
                }
            };

            paperNeeds.forEach(row => checkItem(row, 'paper'));
            plateNeeds.forEach(row => checkItem(row, 'plate'));
            sfgNeeds.forEach(row => checkItem(row, 'sfg'));
            staticsNeeds.forEach(row => checkItem(row, 'statics'));

            if (shortages.length > 0) {
                return NextResponse.json({
                    error: 'insufficient_stock',
                    message: 'Warning: Insufficient stock for some items',
                    shortages
                }, { status: 422 });
            }
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
