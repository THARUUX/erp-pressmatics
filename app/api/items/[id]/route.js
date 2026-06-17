import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateOffset, calculateDigital } from '@/lib/calculations';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // 1. Fetch Main Item
        const [items] = await pool.execute(
            'SELECT * FROM quotation_items WHERE id = ?',
            [id]
        );
        if (items.length === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        const item = items[0];

        // 2. Fetch Details (Components)
        const [details] = await pool.execute(
            'SELECT * FROM quotation_item_details WHERE quotation_item_id = ? ORDER BY id ASC',
            [id]
        );

        // 3. Fetch Finishings
        const [finishings] = await pool.execute(
            `SELECT qif.*, m.speed, m.speed_unit 
             FROM quotation_item_finishings qif
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE qif.quotation_item_id = ?`,
            [id]
        );

        // 4. Assemble Components
        // 4. Assemble Components
        // Group finishings by detail_id
        const finishingsByDetail = {};
        const globalFinishings = [];

        for (const f of finishings) {
            const dId = f.quotation_item_detail_id;
            if (dId) {
                if (!finishingsByDetail[dId]) finishingsByDetail[dId] = [];
                finishingsByDetail[dId].push(f);
            } else {
                globalFinishings.push(f);
            }
        }

        const components = details.map(detail => ({
            ...detail,
            finishings: finishingsByDetail[detail.id] || []
        }));

        return NextResponse.json({ item, components, globalFinishings });
    } catch (error) {
        console.error("Get Item Error:", error);
        return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            customer_name,
            customer_id,
            estimation_name, // New
            job_description,
            // type can be mixed, but we update main type based on first or 'mixed'
            quantity,
            is_favorite,
            components,
            markup_percent = 0, // New
            global_finishings = [] // New
        } = body;

        // Handle Partial Update (e.g. Favorite Toggle)
        if (typeof is_favorite !== 'undefined' && !components) {
            await pool.execute(
                'UPDATE quotation_items SET is_favorite = ? WHERE id = ?',
                [is_favorite, id]
            );
            return NextResponse.json({ success: true });
        }

        if (!components || components.length === 0) {
            return NextResponse.json({ error: 'No components provided' }, { status: 400 });
        }

        // 1. Recalculate Everything
        let subTotal = 0;
        const processedComponents = [];

        for (const comp of components) {
            let result;
            const compParams = {
                ...comp.params,
                quantity: comp.quantity,
                finishings: comp.finishings || [],
                compName: comp.name
            };

            if (comp.type === 'offset') {
                result = calculateOffset(compParams);
            } else if (comp.type === 'digital') {
                result = calculateDigital(compParams);
            } else {
                continue; // error?
            }

            subTotal += result.costs.total;
            processedComponents.push({
                meta: comp,
                calc: result
            });
        }

        // Calculate Global Costs
        let globalFinishingCost = 0;
        const processedGlobalFinishings = global_finishings.map(f => {
            const total = (parseFloat(f.quantity) || 0) * (parseFloat(f.unit_cost) || 0);
            globalFinishingCost += total;
            return {
                ...f,
                total_cost: total
            };
        });

        // Apply Markup
        const totalBeforeMarkup = subTotal + globalFinishingCost;
        const markupAmount = totalBeforeMarkup * ((parseFloat(markup_percent) || 0) / 100);
        const grandTotal = totalBeforeMarkup + markupAmount;
        const mainType = processedComponents[0].meta.type || 'offset'; // Simplification

        // 2. Update Main Item (Header)
        await pool.execute(
            `UPDATE quotation_items SET 
             customer_name = ?, customer_id = ?, estimation_name = ?, job_description = ?, type = ?, quantity = ?, total_amount = ?, markup_percent = ?
             WHERE id = ?`,
            [customer_name, customer_id || null, estimation_name || '', job_description, mainType, quantity, grandTotal, parseFloat(markup_percent) || 0, id]
        );

        // 3. Update Details (Delete All & Insert New)
        // This handles removed components, added components, and changed components easily.
        await pool.execute('DELETE FROM quotation_item_finishings WHERE quotation_item_id = ?', [id]);
        await pool.execute('DELETE FROM quotation_item_details WHERE quotation_item_id = ?', [id]);

        // Insert New Details
        for (const pComp of processedComponents) {
            const { meta, calc } = pComp;
            const params = meta.params;
            const costs = calc.costs;

            const [detailResult] = await pool.execute(
                `INSERT INTO quotation_item_details (
            quotation_item_id, component_name, type, machine_id, pages, paper_cost_per_sheet, plate_cost_unit, 
            impression_cost_unit, wastage_percent, ups, sides, size, colors, colors_front, colors_back, custom_impressions, custom_wastage_sheets,
            printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count,
            final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost,
            paper_id, paper_name, paper_width_cm, paper_height_cm, comp_width_cm, comp_height_cm, cut_width_cm, cut_height_cm, bleed_mm, digital_price_per_sq_cm, color_quality, is_bb, custom_sheet_factor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    meta.name || 'Main',
                    meta.type || 'offset',
                    params.machineId || null,
                    params.pages || 1,
                    params.paperCostPerSheet || 0,
                    params.plateCostPerUnit || 0,
                    params.impressionCostPerUnit || 0,
                    params.wastagePercent || 0,
                    params.ups || 1,
                    params.sides || 1,
                    params.size || null,
                    (parseInt(params.colorsFront) || 0) + (parseInt(params.colorsBack) || 0) || params.colors || 4,
                    parseInt(params.colorsFront) ?? null,
                    parseInt(params.colorsBack) ?? null,
                    params.customImpressions || null,
                    params.customWastageSheets != null && params.customWastageSheets !== '' ? parseInt(params.customWastageSheets) : null,
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
                    params.paperName || null,
                    params.paperWidthCm || null,
                    params.paperHeightCm || null,
                    params.compWidthCm != null && params.compWidthCm !== '' ? parseFloat(params.compWidthCm) : null,
                    params.compHeightCm != null && params.compHeightCm !== '' ? parseFloat(params.compHeightCm) : null,
                    params.cutWidthCm != null && params.cutWidthCm !== '' ? parseFloat(params.cutWidthCm) : null,
                    params.cutHeightCm != null && params.cutHeightCm !== '' ? parseFloat(params.cutHeightCm) : null,
                    params.bleedMm != null && params.bleedMm !== '' ? parseFloat(params.bleedMm) : 3.00,
                    params.digitalPricePerSqCm || null,
                    params.colorQuality || null,
                    params.isBB ? 1 : 0,
                    params.customSheetFactor != null && params.customSheetFactor !== '' ? parseFloat(params.customSheetFactor) : null
                ]
            );
            const detailId = detailResult.insertId;

            // Insert Finishings
            const finishings = meta.finishings || [];
            if (finishings.length > 0) {
                for (const fItem of finishings) {
                    await pool.execute(
                        `INSERT INTO quotation_item_finishings 
                        (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            detailId,
                            fItem.name,
                            fItem.quantity,
                            fItem.unit_cost,
                            fItem.total_cost,
                            fItem.machine_id || null,
                            fItem.is_machine ? 1 : 0,
                            fItem.time_per_unit || 0,
                            fItem.total_time || 0,
                            fItem.cost_unit || 'Unit',
                            fItem.forms != null ? parseInt(fItem.forms) : null
                        ]
                    );
                }
            }
        }

        // Insert Global Finishings
        if (processedGlobalFinishings.length > 0) {
            for (const fItem of processedGlobalFinishings) {
                await pool.execute(
                    `INSERT INTO quotation_item_finishings 
                    (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        null, // Detail ID is NULL for global
                        fItem.name,
                        fItem.quantity,
                        fItem.unit_cost,
                        fItem.total_cost,
                        fItem.machine_id || null,
                        fItem.is_machine ? 1 : 0,
                        fItem.time_per_unit || 0,
                        fItem.total_time || 0,
                        fItem.cost_unit || 'Unit',
                        fItem.forms != null ? parseInt(fItem.forms) : null
                    ]
                );
            }
        }

        return NextResponse.json({ success: true, amount: grandTotal });
    } catch (error) {
        console.error("Update Item Error:", error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        // Manual cascading
        await pool.execute('DELETE FROM quotation_line_items WHERE quotation_item_id = ?', [id]);
        await pool.execute('DELETE FROM quotation_item_finishings WHERE quotation_item_id = ?', [id]);
        await pool.execute('DELETE FROM quotation_item_details WHERE quotation_item_id = ?', [id]);
        await pool.execute('DELETE FROM quotation_items WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete Item Error:", error);
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}
