import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateOffset, calculateDigital } from '@/lib/calculations';

/**
 * POST /api/quotations/[id]/items/[itemId]/recalculate
 *
 * Runs the exact same calculation flow as the item edit page:
 *   1. Fetch all components (quotation_item_details) + their finishings
 *   2. Fetch machine data for each component (to get the real machineSheetFactor)
 *   3. Run calculateOffset / calculateDigital exactly as the item PUT route does
 *   4. Delete old details + finishings and re-insert with new calculated values
 *   5. Apply existing tax_mode on top of the new base cost
 *   6. Update quotation grand total
 */
export async function POST(req, { params }) {
    try {
        const { id, itemId } = await params;
        const body = await req.json();
        const { estimation_name, quantity, tax_mode } = body;

        // ── 1. Fetch main item ───────────────────────────────────────────────────
        const [itemRows] = await pool.execute('SELECT * FROM quotation_items WHERE id = ?', [itemId]);
        if (!itemRows.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        const item = itemRows[0];

        // ── 2. Resolve effective quantity ────────────────────────────────────────
        const effectiveQty = parseInt(quantity) > 0 ? parseInt(quantity) : parseInt(item.quantity);

        // ── 3a. Name-only shortcut ───────────────────────────────────────────────
        if (estimation_name && !tax_mode && !quantity) {
            await pool.execute('UPDATE quotation_items SET estimation_name = ? WHERE id = ?', [estimation_name, itemId]);
            return NextResponse.json({ success: true });
        }

        // ── 3b. Tax-mode-only path ───────────────────────────────────────────────
        // When only tax_mode changes, do NOT re-run the full calculation.
        // Read the pre-tax base cost from the stored detail cost columns (written by
        // the original calculation) and re-apply the new tax on top.
        if (tax_mode && !quantity) {
            const [details] = await pool.execute(
                'SELECT * FROM quotation_item_details WHERE quotation_item_id = ? ORDER BY id ASC', [itemId]
            );
            const [allFinishings] = await pool.execute(
                'SELECT * FROM quotation_item_finishings WHERE quotation_item_id = ?', [itemId]
            );

            // Base cost = sum of all stored cost components (paper + plate + printing + finishing)
            const compBase = details.reduce((s, d) =>
                s + (parseFloat(d.final_paper_cost) || 0)
                  + (parseFloat(d.final_plate_cost) || 0)
                  + (parseFloat(d.final_printing_cost) || 0)
                  + (parseFloat(d.final_finishing_cost) || 0), 0);
            const globalBase = allFinishings
                .filter(f => !f.quotation_item_detail_id)
                .reduce((s, f) => s + parseFloat(f.total_cost || 0), 0);
            const markupPct = parseFloat(item.markup_percent) || 0;
            const preMarkup = compBase + globalBase;
            const baseCost  = preMarkup + preMarkup * (markupPct / 100);

            const [settingsTax] = await pool.execute(
                "SELECT setting_value FROM settings WHERE setting_key = 'default_tax_percentage'"
            );
            const taxRate = settingsTax.length ? parseFloat(settingsTax[0].setting_value) || 0 : 0;

            let subtotalAmount = baseCost, taxAmount = 0, finalTotal = baseCost;
            if (tax_mode === 'add' && taxRate > 0) {
                taxAmount = baseCost * (taxRate / 100);
                finalTotal = baseCost + taxAmount;
                subtotalAmount = baseCost;
            } else if (tax_mode === 'deduct' && taxRate > 0) {
                subtotalAmount = baseCost / (1 + taxRate / 100);
                taxAmount = baseCost - subtotalAmount;
                finalTotal = baseCost;
            }

            await pool.execute(
                `UPDATE quotation_items SET tax_mode=?, tax_amount=?, tax_percentage=?,
                 total_amount=?, subtotal_amount=?,
                 estimation_name=COALESCE(?, estimation_name) WHERE id=?`,
                [tax_mode, taxAmount, taxRate, finalTotal, subtotalAmount, estimation_name || null, itemId]
            );

            const [qItems] = await pool.execute(
                `SELECT qi.total_amount FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = ?`, [id]
            );
            const newTotal = qItems.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
            await pool.execute('UPDATE quotations SET total_amount=? WHERE id=?', [newTotal, id]);

            return NextResponse.json({ success: true, newTotal, itemTotal: finalTotal });
        }

        // ── 3. Fetch all components (details) and their finishings ───────────────
        const [details] = await pool.execute(
            'SELECT * FROM quotation_item_details WHERE quotation_item_id = ? ORDER BY id ASC',
            [itemId]
        );
        if (!details.length) return NextResponse.json({ error: 'Item details not found' }, { status: 400 });

        const [allFinishings] = await pool.execute(
            'SELECT * FROM quotation_item_finishings WHERE quotation_item_id = ?',
            [itemId]
        );

        // Group finishings by detail id (null = global)
        const finishingsByDetail = {};
        const globalFinishings = [];
        for (const f of allFinishings) {
            if (f.quotation_item_detail_id) {
                if (!finishingsByDetail[f.quotation_item_detail_id]) finishingsByDetail[f.quotation_item_detail_id] = [];
                finishingsByDetail[f.quotation_item_detail_id].push(f);
            } else {
                globalFinishings.push(f);
            }
        }

        // ── 4. Fetch machines table once for lookup ──────────────────────────────
        const [allMachines] = await pool.execute('SELECT * FROM machines');
        const machineMap = Object.fromEntries(allMachines.map(m => [m.id, m]));

        // ── 5. Fetch papers table once for lookup ────────────────────────────────
        const [allPapers] = await pool.execute('SELECT * FROM papers');
        const paperMap = Object.fromEntries(allPapers.map(p => [p.id, p]));

        // ── 6. Run calculation for each component (mirror of item PUT route) ─────
        let subTotal = 0;
        const processedComponents = [];

        for (const detail of details) {
            const machine = machineMap[detail.machine_id] || null;
            const paper   = paperMap[detail.paper_id]     || null;
            const comFinishings = finishingsByDetail[detail.id] || [];

            // Build params exactly as handleCalculate does in the UI
            const compParams = {
                quantity:               effectiveQty,
                pages:                  detail.pages,
                ups:                    detail.ups,
                sides:                  detail.sides,
                colors:                 detail.colors,
                colorsFront:            detail.colors_front,
                colorsBack:             detail.colors_back,
                paperCostPerSheet:      detail.paper_cost_per_sheet,
                plateCostPerUnit:       detail.plate_cost_unit,
                impressionCostPerUnit:  detail.impression_cost_unit,
                wastagePercent:         detail.wastage_percent,
                customImpressions:      detail.custom_impressions,
                customWastageSheets:    detail.custom_wastage_sheets,
                // Machine data fetched live from DB — same as selectedMachine in UI
                machineSheetFactor:     machine ? parseFloat(machine.sheet_factor) || 1.0 : 1.0,
                machineSpeed:           machine ? parseFloat(machine.speed)        || 0   : 0,
                machineSpeedUnit:       machine ? machine.speed_unit || 'Sheets/Hr'       : 'Sheets/Hr',
                // Paper dimensions fetched live from DB — same as selectedPaper in UI
                paperWidthCm:           paper ? parseFloat(paper.width)  || 0 : (detail.paper_width_cm  || 0),
                paperHeightCm:          paper ? parseFloat(paper.height) || 0 : (detail.paper_height_cm || 0),
                cutWidthCm:             detail.cut_width_cm,
                cutHeightCm:            detail.cut_height_cm,
                digitalPricePerSqCm:    detail.digital_price_per_sq_cm || 0,
                finishings:             comFinishings,
                compName:               detail.component_name,
            };

            let result;
            if (detail.type === 'offset') {
                result = calculateOffset(compParams);
            } else if (detail.type === 'digital') {
                result = calculateDigital(compParams);
            } else {
                continue;
            }

            subTotal += result.costs.total;
            processedComponents.push({ detail, result, finishings: comFinishings });
        }

        // Global finishing cost (unchanged, just re-sum)
        const globalFinishingCost = globalFinishings.reduce(
            (sum, f) => sum + parseFloat(f.total_cost || 0), 0
        );

        // Apply markup if present
        const markupPercent = parseFloat(item.markup_percent) || 0;
        const totalBeforeMarkup = subTotal + globalFinishingCost;
        const markupAmount = totalBeforeMarkup * (markupPercent / 100);
        const baseCost = totalBeforeMarkup + markupAmount;

        // ── 7. Delete old details + finishings, re-insert (mirror of item PUT) ───
        await pool.execute('DELETE FROM quotation_item_finishings WHERE quotation_item_id = ?', [itemId]);
        await pool.execute('DELETE FROM quotation_item_details WHERE quotation_item_id = ?', [itemId]);

        for (const { detail, result, finishings: compFinishings } of processedComponents) {
            const costs  = result.costs;
            const params = detail; // stored column names match param names closely enough

            const [detailResult] = await pool.execute(
                `INSERT INTO quotation_item_details (
                    quotation_item_id, component_name, type, machine_id, pages, paper_cost_per_sheet, plate_cost_unit,
                    impression_cost_unit, wastage_percent, ups, sides, size, colors, colors_front, colors_back, custom_impressions, custom_wastage_sheets,
                    printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count,
                    final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost,
                    paper_id, paper_name, paper_width_cm, paper_height_cm, comp_width_cm, comp_height_cm,
                    cut_width_cm, cut_height_cm, bleed_mm, digital_price_per_sq_cm, color_quality, is_bb, custom_sheet_factor
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    itemId,
                    params.component_name || 'Main',
                    params.type || 'offset',
                    params.machine_id || null,
                    params.pages || 1,
                    params.paper_cost_per_sheet || 0,
                    params.plate_cost_unit || 0,
                    params.impression_cost_unit || 0,
                    params.wastage_percent || 0,
                    params.ups || 1,
                    params.sides || 1,
                    params.size || null,
                    params.colors || 4,
                    params.colors_front ?? null,
                    params.colors_back ?? null,
                    params.custom_impressions || null,
                    params.custom_wastage_sheets != null ? parseInt(params.custom_wastage_sheets) : null,
                    result.printedSheets    || 0,
                    result.fullSheetsUsed   || 0,
                    result.wastageSheets    || 0,
                    result.totalSheetsRequired || 0,
                    result.plateCount       || 0,
                    costs.paper    || 0,
                    costs.plate    || 0,
                    costs.printing || 0,
                    costs.finishing|| 0,
                    params.paper_id   || null,
                    params.paper_name || null,
                    params.paper_width_cm  || null,
                    params.paper_height_cm || null,
                    params.comp_width_cm   || null,
                    params.comp_height_cm  || null,
                    params.cut_width_cm    || null,
                    params.cut_height_cm   || null,
                    params.bleed_mm        || 3.00,
                    params.digital_price_per_sq_cm || null,
                    params.color_quality   || null,
                    detail.is_bb ? 1 : 0,
                    detail.custom_sheet_factor != null ? parseFloat(detail.custom_sheet_factor) : null,
                ]
            );
            const newDetailId = detailResult.insertId;

            // Re-insert component finishings with computed quantities/costs
            for (const f of result.computedFinishings) {
                await pool.execute(
                    `INSERT INTO quotation_item_finishings
                     (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost,
                      machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        itemId, newDetailId,
                        f.name, f.quantity, f.unit_cost, f.total_cost,
                        f.machine_id || null, f.is_machine ? 1 : 0,
                        f.time_per_unit || 0, f.total_time || 0,
                        f.cost_unit || 'Unit',
                        f.forms != null ? parseInt(f.forms) : null,
                    ]
                );
            }
        }

        // Re-insert global finishings (values unchanged)
        for (const f of globalFinishings) {
            await pool.execute(
                `INSERT INTO quotation_item_finishings
                 (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost,
                  machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    itemId, null,
                    f.name, f.quantity, f.unit_cost, f.total_cost,
                    f.machine_id || null, f.is_machine ? 1 : 0,
                    f.time_per_unit || 0, f.total_time || 0,
                    f.cost_unit || 'Unit',
                    f.forms != null ? parseInt(f.forms) : null,
                ]
            );
        }

        // ── 8. Apply existing tax mode on top of new base cost ───────────────────
        const [settingsRows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'default_tax_percentage'"
        );
        const defaultTaxRate = settingsRows.length ? parseFloat(settingsRows[0].setting_value) || 0 : 0;

        const taxMode = item.tax_mode || 'none';
        let subtotalAmount = baseCost, taxAmount = 0, finalTotal = baseCost;

        if (taxMode === 'add' && defaultTaxRate > 0) {
            taxAmount      = baseCost * (defaultTaxRate / 100);
            finalTotal     = baseCost + taxAmount;
            subtotalAmount = baseCost;
        } else if (taxMode === 'deduct' && defaultTaxRate > 0) {
            subtotalAmount = baseCost / (1 + defaultTaxRate / 100);
            taxAmount      = baseCost - subtotalAmount;
            finalTotal     = baseCost;
        }

        // ── 9. Update quotation_items row (this IS the estimation record) ────────
        await pool.execute(
            `UPDATE quotation_items
             SET quantity=?, total_amount=?, subtotal_amount=?, tax_amount=?, tax_percentage=?,
                 estimation_name=COALESCE(?, estimation_name)
             WHERE id=?`,
            [effectiveQty, finalTotal, subtotalAmount, taxAmount, defaultTaxRate, estimation_name || null, itemId]
        );

        // ── 10. Update quotation grand total ─────────────────────────────────────
        const [qItems] = await pool.execute(
            `SELECT qi.total_amount FROM quotation_items qi
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             WHERE qli.quotation_id = ?`,
            [id]
        );
        const newQuotationTotal = qItems.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
        await pool.execute('UPDATE quotations SET total_amount=? WHERE id=?', [newQuotationTotal, id]);

        return NextResponse.json({ success: true, newTotal: newQuotationTotal, itemTotal: finalTotal });

    } catch (error) {
        console.error('[Recalculate Error]', error);
        return NextResponse.json({ error: 'Failed to recalculate', details: error.message }, { status: 500 });
    }
}
