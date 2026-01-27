import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req, { params }) {
    try {
        const { id } = await params;

        // 1. Fetch Source Item
        const [items] = await pool.execute('SELECT * FROM quotation_items WHERE id = ?', [id]);
        if (items.length === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        const sourceItem = items[0];

        // Fetch Settings for Code Generation
        const [settingsRows] = await pool.execute("SELECT * FROM settings WHERE setting_key IN ('item_code_template', 'item_code_seq')");
        const settingsMap = {};
        settingsRows.forEach(row => settingsMap[row.setting_key] = row.setting_value);

        let template = settingsMap['item_code_template'] || 'INV-{0000}';
        let seq = parseInt(settingsMap['item_code_seq'] || '1000');
        let code = template.replace('{0000}', String(seq).padStart(4, '0'))
            .replace('{SEQ}', String(seq));

        // 2. Create New Item Header
        const [itemResult] = await pool.execute(
            `INSERT INTO quotation_items (customer_name, job_description, type, quantity, total_amount, status, is_favorite, code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sourceItem.customer_name,
                `COPY - ${sourceItem.job_description}`,
                sourceItem.type,
                sourceItem.quantity,
                sourceItem.total_amount,
                sourceItem.status,
                false, // not favorite by default
                code
            ]
        );

        // Increment Sequence
        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'item_code_seq'", [String(seq + 1)]);
        const newItemId = itemResult.insertId;

        // 3. Fetch Source Details
        const [sourceDetails] = await pool.execute(
            'SELECT * FROM quotation_item_details WHERE quotation_item_id = ?',
            [id]
        );

        // 4. Fetch Source Finishings
        const [sourceFinishings] = await pool.execute(
            'SELECT * FROM quotation_item_finishings WHERE quotation_item_id = ?',
            [id]
        );

        // Group finishings by Detail ID
        const finishingsByDetail = {};
        for (const f of sourceFinishings) {
            const dId = f.quotation_item_detail_id;
            if (!finishingsByDetail[dId]) finishingsByDetail[dId] = [];
            finishingsByDetail[dId].push(f);
        }

        // 5. Duplicate Details & Finishings
        for (const detail of sourceDetails) {
            const [detailResult] = await pool.execute(
                `INSERT INTO quotation_item_details (
                    quotation_item_id, component_name, machine_id, pages, paper_cost_per_sheet, plate_cost_unit, 
                    impression_cost_unit, wastage_percent, ups, sides, colors,
                    printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count,
                    final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost,
                    paper_id, paper_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newItemId,
                    detail.component_name,
                    detail.machine_id,
                    detail.pages,
                    detail.paper_cost_per_sheet,
                    detail.plate_cost_unit,
                    detail.impression_cost_unit,
                    detail.wastage_percent,
                    detail.ups,
                    detail.sides,
                    detail.colors,
                    detail.printed_sheets,
                    detail.full_sheets_used,
                    detail.wastage_sheets,
                    detail.total_sheets,
                    detail.plate_count,
                    detail.final_paper_cost,
                    detail.final_plate_cost,
                    detail.final_printing_cost,
                    detail.final_finishing_cost,
                    detail.paper_id,
                    detail.paper_name
                ]
            );
            const newDetailId = detailResult.insertId;

            const relatedFinishings = finishingsByDetail[detail.id] || [];
            for (const f of relatedFinishings) {
                await pool.execute(
                    `INSERT INTO quotation_item_finishings 
                    (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newItemId,
                        newDetailId,
                        f.name,
                        f.quantity,
                        f.unit_cost,
                        f.total_cost,
                        f.machine_id,
                        f.is_machine,
                        f.time_per_unit,
                        f.total_time,
                        f.cost_unit
                    ]
                );
            }
        }

        return NextResponse.json({ success: true, newId: newItemId });

    } catch (error) {
        console.error("Duplicate Error:", error);
        return NextResponse.json({ error: 'Failed to duplicate item' }, { status: 500 });
    }
}
