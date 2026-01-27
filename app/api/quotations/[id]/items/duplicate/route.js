import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req, { params }) {
    try {
        const { id } = await params; // Quotation ID
        const body = await req.json();
        const { itemId } = body; // Item ID to duplicate

        if (!itemId) {
            return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
        }

        // 1. Duplicate the Item
        const [rows] = await pool.execute('SELECT * FROM quotation_items WHERE id = ?', [itemId]);
        if (rows.length === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        const sourceItem = rows[0];

        // Generate new code 
        // (Simplified: Fetch seq, increment, insert. Race condition possible but rare in this context)
        const [settings] = await pool.execute("SELECT setting_value FROM settings WHERE setting_key = 'item_code_seq'");
        let seq = 1000;
        if (settings.length > 0) seq = parseInt(settings[0].setting_value);

        const [templateSettings] = await pool.execute("SELECT setting_value FROM settings WHERE setting_key = 'item_code_template'");
        let template = 'INV-{0000}';
        if (templateSettings.length > 0) template = templateSettings[0].setting_value;

        const newCode = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // Insert new item
        const [result] = await pool.execute(
            `INSERT INTO quotation_items 
            (customer_name, customer_id, estimation_name, job_description, type, quantity, total_amount, status, code, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'linked', ?, NOW())`,
            [
                sourceItem.customer_name,
                sourceItem.customer_id,
                sourceItem.estimation_name + ' (Copy)',
                sourceItem.job_description,
                sourceItem.type,
                sourceItem.quantity,
                sourceItem.total_amount,
                newCode
            ]
        );
        const newItemId = result.insertId;

        // Update Seq
        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'item_code_seq'", [String(seq + 1)]);

        // 2. Duplicate Details
        const [details] = await pool.execute('SELECT * FROM quotation_item_details WHERE quotation_item_id = ?', [itemId]);
        if (details.length > 0) {
            const d = details[0];
            const [detRes] = await pool.execute(
                `INSERT INTO quotation_item_details 
                (quotation_item_id, component_name, machine_id, pages, paper_cost_per_sheet, plate_cost_unit, impression_cost_unit, wastage_percent, ups, sides, colors, printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count, final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost, paper_id, paper_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newItemId, d.component_name, d.machine_id, d.pages, d.paper_cost_per_sheet, d.plate_cost_unit, d.impression_cost_unit, d.wastage_percent, d.ups, d.sides, d.colors, d.printed_sheets, d.full_sheets_used, d.wastage_sheets, d.total_sheets, d.plate_count, d.final_paper_cost, d.final_plate_cost, d.final_printing_cost, d.final_finishing_cost, d.paper_id, d.paper_name
                ]
            );
            const newDetailId = detRes.insertId;

            // 3. Duplicate Finishings
            const [finishings] = await pool.execute('SELECT * FROM quotation_item_finishings WHERE quotation_item_id = ?', [itemId]);
            for (const f of finishings) {
                await pool.execute(
                    `INSERT INTO quotation_item_finishings
                    (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newItemId, newDetailId, f.name, f.quantity, f.unit_cost, f.total_cost, f.machine_id, f.is_machine, f.time_per_unit, f.total_time, f.cost_unit]
                );
            }
        }

        // 4. Link new item to Quotation
        // Get max display order
        const [orderRows] = await pool.execute('SELECT MAX(display_order) as maxOrder FROM quotation_line_items WHERE quotation_id = ?', [id]);
        const maxOrder = orderRows[0].maxOrder || 0;

        await pool.execute(
            `INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order) VALUES (?, ?, ?)`,
            [id, newItemId, maxOrder + 1]
        );

        // 5. Update Quotation Total
        // Recalculate full total
        const [qItems] = await pool.execute(`
            SELECT qi.total_amount 
            FROM quotation_items qi
            JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
            WHERE qli.quotation_id = ?
        `, [id]);
        const newTotal = qItems.reduce((sum, i) => sum + parseFloat(i.total_amount), 0);

        await pool.execute('UPDATE quotations SET total_amount = ? WHERE id = ?', [newTotal, id]);

        return NextResponse.json({ success: true, newItemId, newTotal });

    } catch (error) {
        console.error("Duplicate Item Error:", error);
        return NextResponse.json({ error: 'Failed to duplicate item', details: error.message }, { status: 500 });
    }
}
