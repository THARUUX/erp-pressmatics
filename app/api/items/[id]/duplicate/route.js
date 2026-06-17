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
                false, 
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

        // Separate component finishings from global finishings reliably
        const finishingsByDetail = {};
        const globalFinishings = [];

        for (const f of sourceFinishings) {
            const dId = f.quotation_item_detail_id;
            if (dId === null || dId === undefined) {
                globalFinishings.push(f);
            } else {
                if (!finishingsByDetail[dId]) finishingsByDetail[dId] = [];
                finishingsByDetail[dId].push(f);
            }
        }

        // 5. Duplicate Details & Linked Finishings
        for (const detail of sourceDetails) {
            const [detailResult] = await pool.execute(
                `INSERT INTO quotation_item_details (
                    quotation_item_id, component_name, machine_id, pages, paper_cost_per_sheet, plate_cost_unit, 
                    impression_cost_unit, wastage_percent, ups, sides, size, colors, colors_front, colors_back, custom_impressions, custom_wastage_sheets,
                    printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count,
                    final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost,
                    paper_id, paper_name, type, paper_width_cm, paper_height_cm, comp_width_cm, comp_height_cm, cut_width_cm, cut_height_cm, bleed_mm, digital_price_per_sq_cm, color_quality
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    detail.size || null,
                    detail.colors,
                    detail.colors_front ?? null,
                    detail.colors_back ?? null,
                    detail.custom_impressions,
                    detail.custom_wastage_sheets,
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
                    detail.paper_name,
                    detail.type,
                    detail.paper_width_cm,
                    detail.paper_height_cm,
                    detail.comp_width_cm,
                    detail.comp_height_cm,
                    detail.cut_width_cm,
                    detail.cut_height_cm,
                    detail.bleed_mm,
                    detail.digital_price_per_sq_cm,
                    detail.color_quality
                ]
            );
            const newDetailId = detailResult.insertId;

            const relatedFinishings = finishingsByDetail[detail.id] || [];
            for (const f of relatedFinishings) {
                await pool.execute(
                    `INSERT INTO quotation_item_finishings 
                    (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                        f.cost_unit,
                        f.forms
                    ]
                );
            }
        }

        // 6. Duplicate Global Finishings (Explicitly using the clean array)
        for (const f of globalFinishings) {
            await pool.execute(
                `INSERT INTO quotation_item_finishings 
                (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newItemId,
                    null,
                    f.name,
                    f.quantity,
                    f.unit_cost,
                    f.total_cost,
                    f.machine_id,
                    f.is_machine,
                    f.time_per_unit,
                    f.total_time,
                    f.cost_unit,
                    f.forms
                ]
            );
        }

        return NextResponse.json({ success: true, newId: newItemId });

    } catch (error) {
        console.error("Duplicate Error:", error);
        return NextResponse.json({ error: 'Failed to duplicate item', details: error.message }, { status: 500 });
    }
}