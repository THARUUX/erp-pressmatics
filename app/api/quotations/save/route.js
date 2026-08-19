import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { logActivity } from '@/lib/activityLogger';

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
            // Ignore statics stock shortages since they only have active/inactive status
            // staticsNeeds.forEach(row => checkItem(row, 'statics'));

            if (shortages.length > 0) {
                return NextResponse.json({
                    error: 'insufficient_stock',
                    message: 'Warning: Insufficient stock for some items',
                    shortages
                }, { status: 422 });
            }
        }

        // 1. Determine Customer VAT status & Default Tax Rate
        let isVatCustomer = false;
        if (customer_id) {
            const [custRows] = await pool.execute('SELECT is_vat FROM customers WHERE id = ?', [customer_id]);
            if (custRows.length && (custRows[0].is_vat === 1 || custRows[0].is_vat === true)) {
                isVatCustomer = true;
            }
        } else if (customer_name) {
            const [custRows] = await pool.execute('SELECT is_vat FROM customers WHERE name = ?', [customer_name]);
            if (custRows.length && (custRows[0].is_vat === 1 || custRows[0].is_vat === true)) {
                isVatCustomer = true;
            }
        }

        const [settingsTax] = await pool.execute("SELECT setting_value FROM settings WHERE setting_key = 'default_tax_percentage'");
        const defaultTaxRate = settingsTax.length ? parseFloat(settingsTax[0].setting_value) || 0 : 0;

        // 2. Fetch items & update tax fields based on customer VAT status
        const placeholders = selected_item_ids.map(() => '?').join(',');
        const [items] = await pool.execute(
            `SELECT id, total_amount, subtotal_amount, tax_amount, tax_mode, job_description FROM quotation_items WHERE id IN (${placeholders})`,
            selected_item_ids
        );

        for (const item of items) {
            // Determine pure base cost before tax
            let baseCost = parseFloat(item.total_amount || 0);
            if (item.tax_mode === 'add' && parseFloat(item.subtotal_amount) > 0) {
                baseCost = parseFloat(item.subtotal_amount);
            } else if (item.tax_mode === 'deduct' && parseFloat(item.total_amount) > 0) {
                baseCost = parseFloat(item.total_amount);
            } else {
                baseCost = parseFloat(item.total_amount || 0);
            }

            if (isVatCustomer && defaultTaxRate > 0) {
                const taxAmount = baseCost * (defaultTaxRate / 100);
                const finalTotal = baseCost + taxAmount;
                const subtotalAmount = baseCost;

                await pool.execute(
                    `UPDATE quotation_items 
                     SET tax_mode = 'add', tax_percentage = ?, tax_amount = ?, subtotal_amount = ?, total_amount = ? 
                     WHERE id = ?`,
                    [defaultTaxRate, taxAmount, subtotalAmount, finalTotal, item.id]
                );
            } else {
                await pool.execute(
                    `UPDATE quotation_items 
                     SET tax_mode = 'none', tax_percentage = ?, tax_amount = 0, subtotal_amount = ?, total_amount = ? 
                     WHERE id = ?`,
                    [defaultTaxRate, baseCost, baseCost, item.id]
                );
            }
        }

        // Re-fetch updated items for quotation header calculations
        const [updatedItems] = await pool.execute(
            `SELECT id, total_amount, job_description FROM quotation_items WHERE id IN (${placeholders})`,
            selected_item_ids
        );

        const totalAmount = updatedItems.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);

        // Generate Quotation Code
        const [settings] = await pool.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('quotation_id_template', 'quotation_id_seq')");
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let seq = parseInt(settingsMap['quotation_id_seq'] || '1');
        let template = settingsMap['quotation_id_template'] || 'QTN-{0000}';

        const code = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // Use first item description or generic
        const jobDescription = updatedItems.length > 0 ? updatedItems[0].job_description + (updatedItems.length > 1 ? ` (+${updatedItems.length - 1} others)` : '') : 'New Quotation';

        // 3. Insert Quotation Header
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

        logActivity({
            req,
            action: 'CREATE',
            entity_type: 'quotation',
            entity_id: code,
            details: `Created quotation "${code}" for customer "${customer_name}" (LKR ${totalAmount.toFixed(2)})`
        });

        return NextResponse.json({ success: true, quotationId });

    } catch (error) {
        console.error("Save Quotation Container Error:", error);
        return NextResponse.json({ error: 'Failed to save quotation', details: error.message }, { status: 500 });
    }
}
