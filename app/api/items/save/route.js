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
            components = [],
            markup_percent = 0,
            global_finishings = []
        } = body;

        if (!components || components.length === 0) {
            return NextResponse.json({ error: 'No components provided' }, { status: 400 });
        }

        // 1. Calculate Grand Total & Prepare Data
        // We'll recalculate everything server-side to ensure integrity
        let grandTotal = 0;
        const processedComponents = [];

        for (const comp of components) {
            const isSFGComp = comp.type === 'sfg' || (comp.name || '').toLowerCase().includes('assets') || (comp.name || '').toLowerCase().includes('sfg');
            const isServicesComp = comp.type === 'services' || (comp.name || '').toLowerCase().includes('service');
            let result;

            if (isServicesComp) {
                const servicesCost = (comp.services || []).reduce((acc, s) =>
                    acc + (parseFloat(s.rate) || 0) * (parseFloat(s.multiply_by) || 0), 0);
                result = {
                    costs: { paper: 0, plate: 0, printing: 0, finishing: 0, total: servicesCost },
                    printedSheets: 0, fullSheetsUsed: 0, wastageSheets: 0,
                    totalSheetsRequired: 0, plateCount: 0,
                    computedFinishings: []
                };
            } else if (isSFGComp) {
                // SFG/Asset components: sum their sfgLines as cost, no print calculation
                const sfgLinesCost = (comp.sfgLines || []).reduce((acc, sl) =>
                    acc + (parseFloat(sl.quantity) || 0) * (parseFloat(sl.unit_price) || 0), 0);
                // Also include any staticsLines attached to this component
                const staticsLinesCost = (comp.staticsLines || []).reduce((acc, sl) =>
                    acc + (parseFloat(sl.quantity) || 0) * (parseFloat(sl.unit_price) || 0), 0);

                // Calculate finishings if present for SFG/Asset components
                const finishings = comp.finishings || [];
                const qty = parseInt(comp.quantity) || 0;
                const pagesVal = parseInt(comp.params?.pages) || 1;
                const upsVal = parseInt(comp.params?.ups) || 1;
                const sidesVal = parseInt(comp.params?.sides) || 1;
                const totalPages = pagesVal * qty;
                const divisor = upsVal * sidesVal;
                const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;
                const wastePct = parseFloat(comp.params?.wastagePercent) || 0;
                const customWasteVal = parseInt(comp.params?.customWastageSheets ?? comp.params?.custom_waste_sheets ?? comp.params?.custom_wastage_sheets);
                const wastageCutSheets = (!isNaN(customWasteVal) && customWasteVal >= 0)
                    ? customWasteVal * (pagesVal / (upsVal * sidesVal))
                    : wastePct;
                const totalCutSheets = Math.ceil(cutSheets + wastageCutSheets);

                const compWidthCm = parseFloat(comp.params?.compWidthCm) || 21.0;
                const compHeightCm = parseFloat(comp.params?.compHeightCm) || 29.7;

                let finishingCost = 0;
                let finishingTime = 0;
                const computedFinishings = finishings.map(item => {
                    let unitQty = parseInt(item.quantity) || 0;
                    const costUnit = item.cost_unit || 'Unit';

                    if (costUnit === 'Page') {
                        unitQty = totalPages; 
                    } else if (costUnit === 'Cut Sheet') {
                        unitQty = Math.ceil(cutSheets);
                    } else if (costUnit === 'Form') {
                        const itemForms = parseInt(item.forms) || 1;
                        unitQty = itemForms * qty;
                    } else if (costUnit === 'SqInch') {
                        const widthInches = ((compWidthCm / 2.54) + 0.5);
                        const heightInches = ((compHeightCm / 2.54) + 0.5);
                        const sqInQty = widthInches * heightInches * (qty + wastageCutSheets);
                        unitQty = sqInQty;
                    } else {
                        unitQty = Math.ceil(qty);
                    }

                    const total = unitQty * (parseFloat(item.unit_cost) || 0);

                    // Time Calculation (SFG Finishing)
                    let totalTime = 0;
                    if (item.speed && (parseFloat(item.speed) > 0)) {
                        const speed = parseFloat(item.speed);
                        const u = (item.speed_unit || 'Sheets/Hr').toLowerCase().trim();
                        if (u === 'prints/hr') {
                            totalTime = (totalCutSheets * sidesVal) / speed;
                        } else if (u === 'sheets/hr') {
                            totalTime = totalCutSheets / speed;
                        } else if (u === 'impressions/hr') {
                            const impressions = pagesVal * (qty <= 1000 ? 1000 : qty) / (sidesVal * upsVal) * (sidesVal * 4);
                            totalTime = impressions / speed;
                        } else {
                            totalTime = qty / speed;
                        }
                    }

                    return {
                        ...item,
                        quantity: unitQty,
                        total_cost: total,
                        total_time: totalTime
                    };
                });

                finishingCost = computedFinishings.reduce((acc, item) => acc + item.total_cost, 0);
                finishingTime = computedFinishings.reduce((acc, item) => acc + (item.total_time || 0), 0);

                result = {
                    costs: { paper: 0, plate: 0, printing: 0, finishing: finishingCost, total: sfgLinesCost + staticsLinesCost + finishingCost },
                    printedSheets: 0, fullSheetsUsed: 0, wastageSheets: 0,
                    totalSheetsRequired: 0, plateCount: 0,
                    time: { printing: 0, finishing: finishingTime, setup: 0, total: finishingTime },
                    computedFinishings: computedFinishings
                };
            } else {
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
                    continue; // Skip unrecognized types
                }
            }

            // For every component type, add staticsLines cost on top of the computed result
            const staticsLinesCostAll = (comp.staticsLines || []).reduce((acc, sl) =>
                acc + (parseFloat(sl.quantity) || 0) * (parseFloat(sl.unit_price) || 0), 0);
            // Only add once — SFG branch already includes staticsLinesCost, others don't
            if (!isSFGComp && staticsLinesCostAll > 0) {
                result = {
                    ...result,
                    costs: {
                        ...result.costs,
                        total: (result.costs.total || 0) + staticsLinesCostAll,
                    }
                };
            }

            grandTotal += result.costs.total;
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
        const totalBeforeMarkup = grandTotal + globalFinishingCost;
        const markupAmount = totalBeforeMarkup * ((parseFloat(markup_percent) || 0) / 100);
        grandTotal = totalBeforeMarkup + markupAmount;

        // 2. Save Quotation Item (Header)
        // Item Quantity? Usually the main product quantity.
        // Assuming first component dict data or a global quantity was passed?
        // The user didn't specify global quantity, but usually "1000 Brochures".
        // Let's use the first component's quantity as the 'primary' quantity or allow a global field.
        // UI should send `quantity` at root ideally.
        const mainQuantity = body.quantity || components[0].quantity;

        // Type? Mixed? If all same, use that, else 'mixed'.
        const mainType = components.every(c => c.type === components[0].type) ? components[0].type : 'mixed';

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Fetch Settings for Code Generation
            const [settingsRows] = await connection.execute("SELECT * FROM settings WHERE setting_key IN ('item_code_template', 'item_code_seq')");
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

            const [itemResult] = await connection.execute(
                `INSERT INTO quotation_items (customer_name, customer_id, estimation_name, job_description, type, quantity, total_amount, status, code, markup_percent) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
                [customer_name, customer_id || null, estimation_name || '', job_description, mainType, mainQuantity, grandTotal, code, parseFloat(markup_percent) || 0]
            );

            // Increment Sequence
            await connection.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'item_code_seq'", [String(seq + 1)]);
            const itemId = itemResult.insertId;

            // 3. Save Components (Details)
            for (const pComp of processedComponents) {
                const { meta, calc } = pComp;
                const params = meta.params;
                const costs = calc.costs;
                const isServicesComp = meta.type === 'services' || (meta.name || '').toLowerCase().includes('service');
                const isSFGComp = meta.type === 'sfg' || (meta.name || '').toLowerCase().includes('assets') || (meta.name || '').toLowerCase().includes('sfg');

                const [detailResult] = await connection.execute(
                    `INSERT INTO quotation_item_details (
                quotation_item_id, component_name, type, machine_id, pages, paper_cost_per_sheet, plate_cost_unit, 
                impression_cost_unit, wastage_percent, ups, sides, size, colors, colors_front, colors_back, custom_impressions, custom_wastage_sheets, custom_plate_count,
                printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count,
                final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost,
                paper_id, paper_name, paper_width_cm, paper_height_cm, comp_width_cm, comp_height_cm, cut_width_cm, cut_height_cm, bleed_mm, digital_price_per_sq_cm, color_quality, is_bb, custom_sheet_factor
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        itemId,
                        meta.name || 'Main',
                        isSFGComp ? 'sfg' : (isServicesComp ? 'services' : (meta.type || 'offset')),
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
                        (params.customWastageSheets !== null && params.customWastageSheets !== undefined && params.customWastageSheets !== '') ? parseInt(params.customWastageSheets) : null,
                        (params.customPlateCount !== null && params.customPlateCount !== undefined && params.customPlateCount !== '') ? parseInt(params.customPlateCount) : null,
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

                // 4. Save Finishings linked to Detail
                const finishings = calc.computedFinishings || [];
                if (finishings.length > 0) {
                    for (const fItem of finishings) {
                        await connection.execute(
                            `INSERT INTO quotation_item_finishings 
                            (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                                fItem.cost_unit || 'Unit',
                                fItem.forms != null ? parseInt(fItem.forms) : null
                            ]
                        );
                    }
                }

                // Insert SFG Lines
                const sfgLines = meta.sfgLines || [];
                for (const sl of sfgLines) {
                    const qty = parseFloat(sl.quantity) || 0;
                    const price = parseFloat(sl.unit_price) || 0;
                    await connection.execute(
                        `INSERT INTO quotation_item_sfg_lines
                        (quotation_item_detail_id, inventory_item_id, item_name, item_code, quantity, unit_price, total_price, is_statics)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                        [
                            detailId,
                            sl.inventory_item_id,
                            sl.item_name || '',
                            sl.item_code || '',
                            qty,
                            price,
                            qty * price
                        ]
                    );
                }

                // Insert Statics Lines (stored in same table as SFG, flagged with is_statics=1)
                const staticsLines = meta.staticsLines || [];
                for (const sl of staticsLines) {
                    const qty = parseFloat(sl.quantity) || 0;
                    const price = parseFloat(sl.unit_price) || 0;
                    await connection.execute(
                        `INSERT INTO quotation_item_sfg_lines
                        (quotation_item_detail_id, inventory_item_id, item_name, item_code, quantity, unit_price, total_price, is_statics)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                        [
                            detailId,
                            sl.inventory_item_id,
                            sl.item_name || '',
                            sl.item_code || '',
                            qty,
                            price,
                            qty * price
                        ]
                    );
                }

                // Insert Services
                if (isServicesComp) {
                    const services = meta.services || [];
                    for (const s of services) {
                        await connection.execute(
                            `INSERT INTO quotation_item_services 
                            (quotation_item_id, quotation_item_detail_id, service_id, service_name, employee_name, rate_unit, rate, multiply_by, note, total_cost)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                itemId,
                                detailId,
                                s.service_id,
                                s.service_name || '',
                                s.employee_name || '',
                                s.rate_unit || 'per hour',
                                parseFloat(s.rate) || 0.00,
                                parseFloat(s.multiply_by) || 1.00,
                                s.note || null,
                                (parseFloat(s.rate) || 0) * (parseFloat(s.multiply_by) || 1.00)
                            ]
                        );
                    }
                }
            }

            // 5. Insert Global Finishings
            if (processedGlobalFinishings.length > 0) {
                for (const fItem of processedGlobalFinishings) {
                    await connection.execute(
                        `INSERT INTO quotation_item_finishings 
                        (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost, machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            itemId,
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

            await connection.commit();
            return NextResponse.json({ success: true, itemId, amount: grandTotal });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Save Multi-Item Error:", error);
        return NextResponse.json({ error: 'Failed to save item', details: error.message }, { status: 500 });
    }
}
