import { NextResponse } from 'next/server';
import { calculateOffset, calculateDigital } from '@/lib/calculations';
import pool from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            customer_name,
            customer_id,
            estimation_name, // New field
            job_description,
            components = []
        } = body;

        if (!components || components.length === 0) {
            return NextResponse.json({ error: 'No components provided' }, { status: 400 });
        }

        // 1. Calculate Grand Total & Prepare Data
        // We'll recalculate everything server-side to ensure integrity
        let grandTotal = 0;
        const processedComponents = [];

        for (const comp of components) {
            let result;
            const compParams = {
                ...comp.params,
                quantity: comp.quantity,
                finishings: comp.finishings || []
            };

            if (comp.type === 'offset') {
                result = calculateOffset(compParams);
            } else if (comp.type === 'digital') {
                result = calculateDigital(compParams);
            } else {
                // Skip or error?
                continue;
            }

            grandTotal += result.costs.total;
            processedComponents.push({
                meta: comp,
                calc: result
            });
        }

        // 2. Save Quotation Item (Header)
        // Item Quantity? Usually the main product quantity.
        // Assuming first component dict data or a global quantity was passed?
        // The user didn't specify global quantity, but usually "1000 Brochures".
        // Let's use the first component's quantity as the 'primary' quantity or allow a global field.
        // UI should send `quantity` at root ideally.
        const mainQuantity = body.quantity || components[0].quantity;

        // Type? Mixed? If all same, use that, else 'mixed'.
        const mainType = components.every(c => c.type === components[0].type) ? components[0].type : 'mixed';

        // Fetch Settings for Code Generation
        const [settingsRows] = await pool.execute("SELECT * FROM settings WHERE setting_key IN ('item_code_template', 'item_code_seq')");
        const settingsMap = {};
        settingsRows.forEach(row => settingsMap[row.setting_key] = row.setting_value);

        let template = settingsMap['item_code_template'] || 'INV-{0000}';
        let seq = parseInt(settingsMap['item_code_seq'] || '1000');

        // Generate Code
        let code = template.replace('{0000}', String(seq).padStart(4, '0'))
            .replace('{SEQ}', String(seq));

        // Check uniqueness loop (simple fail-safe)
        // Ideally DB constraint handles it, but let's increment if collision? 
        // For now, assume sequential is safe enough with optimistic locking or just simple increment.

        const [itemResult] = await pool.execute(
            `INSERT INTO quotation_items (customer_name, customer_id, estimation_name, job_description, type, quantity, total_amount, status, code) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [customer_name, customer_id || null, estimation_name || '', job_description, mainType, mainQuantity, grandTotal, code]
        );

        // Increment Sequence
        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'item_code_seq'", [String(seq + 1)]);
        const itemId = itemResult.insertId;

        // 3. Save Components (Details)
        for (const pComp of processedComponents) {
            const { meta, calc } = pComp;
            const params = meta.params;
            const costs = calc.costs;

            const [detailResult] = await pool.execute(
                `INSERT INTO quotation_item_details (
            quotation_item_id, component_name, machine_id, pages, paper_cost_per_sheet, plate_cost_unit, 
            impression_cost_unit, wastage_percent, ups, sides, colors,
            printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count,
            final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost,
            paper_id, paper_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    itemId,
                    meta.name || 'Main',
                    params.machineId || null,
                    params.pages || 1,
                    params.paperCostPerSheet || 0,
                    params.plateCostPerUnit || 0,
                    params.impressionCostPerUnit || 0,
                    params.wastagePercent || 0,
                    params.ups || 1,
                    params.sides || 1,
                    params.colors || 4,
                    calc.printedSheets || 0,
                    calc.fullSheetsUsed || 0,
                    calc.wastageSheets || 0,
                    calc.totalSheetsRequired || 0,
                    calc.plateCount || 0,
                    costs.paper || 0,
                    costs.plate || 0,
                    costs.printing || 0,
                    costs.finishing || 0,
                    params.paperId || null,
                    params.paperName || null
                ]
            );
            const detailId = detailResult.insertId;

            // 4. Save Finishings linked to Detail
            const finishings = meta.finishings || [];
            if (finishings.length > 0) {
                for (const fItem of finishings) {
                    await pool.execute(
                        `INSERT INTO quotation_item_finishings 
                        (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            itemId,
                            detailId,
                            fItem.name,
                            fItem.quantity,
                            fItem.unit_cost,
                            fItem.total_cost,
                            fItem.machine_id || null,
                            fItem.is_machine ? 1 : 0,
                            fItem.time_per_unit || 0,
                            fItem.total_time || 0,
                            fItem.cost_unit || 'Unit'
                        ]
                    );
                }
            }
        }

        return NextResponse.json({ success: true, itemId, amount: grandTotal });
    } catch (error) {
        console.error("Save Multi-Item Error:", error);
        return NextResponse.json({ error: 'Failed to save item', details: error.message }, { status: 500 });
    }
}
