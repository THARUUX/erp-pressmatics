import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateOffset, calculateDigital } from '@/lib/calculations';

export async function POST(req, { params }) {
    try {
        const { id } = await params; // Quotation ID
        const body = await req.json();
        const { itemId } = body;

        if (!itemId) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });

        // ── 1. Fetch source item ─────────────────────────────────────────────────
        const [rows] = await pool.execute('SELECT * FROM quotation_items WHERE id = ?', [itemId]);
        if (!rows.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        const sourceItem = rows[0];

        // ── 2. Generate new item code ────────────────────────────────────────────
        const [settings] = await pool.execute(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('item_code_seq', 'item_code_template')"
        );
        const sMap = Object.fromEntries(settings.map(s => [s.setting_key, s.setting_value]));
        const seq      = parseInt(sMap['item_code_seq'] || '1000');
        const template = sMap['item_code_template'] || 'INV-{0000}';
        const newCode  = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));
        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'item_code_seq'", [String(seq + 1)]);

        // ── 3. Insert duplicated item header ─────────────────────────────────────
        const [itemResult] = await pool.execute(
            `INSERT INTO quotation_items
             (customer_name, customer_id, estimation_name, job_description, type, quantity,
              total_amount, subtotal_amount, tax_amount, tax_percentage, tax_mode,
              markup_percent, status, code, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'linked', ?, NOW())`,
            [
                sourceItem.customer_name,
                sourceItem.customer_id,
                (sourceItem.estimation_name || sourceItem.job_description || '') + ' (Copy)',
                sourceItem.job_description,
                sourceItem.type,
                sourceItem.quantity,
                sourceItem.total_amount,
                sourceItem.subtotal_amount,
                sourceItem.tax_amount,
                sourceItem.tax_percentage,
                sourceItem.tax_mode || 'none',
                sourceItem.markup_percent || 0,
                newCode,
            ]
        );
        const newItemId = itemResult.insertId;

        // ── 4. Fetch ALL source details and finishings ───────────────────────────
        const [sourceDetails] = await pool.execute(
            'SELECT * FROM quotation_item_details WHERE quotation_item_id = ? ORDER BY id ASC',
            [itemId]
        );
        const [sourceFinishings] = await pool.execute(
            'SELECT * FROM quotation_item_finishings WHERE quotation_item_id = ?',
            [itemId]
        );

        // Group finishings by detail id
        const finishingsByDetail = {};
        const globalFinishings   = [];
        for (const f of sourceFinishings) {
            if (f.quotation_item_detail_id) {
                if (!finishingsByDetail[f.quotation_item_detail_id]) finishingsByDetail[f.quotation_item_detail_id] = [];
                finishingsByDetail[f.quotation_item_detail_id].push(f);
            } else {
                globalFinishings.push(f);
            }
        }

        // ── 5. Fetch machine & paper lookups for recalculation ───────────────────
        const [allMachines] = await pool.execute('SELECT * FROM machines');
        const machineMap = Object.fromEntries(allMachines.map(m => [m.id, m]));

        const [allPapers] = await pool.execute('SELECT * FROM papers');
        const paperMap = Object.fromEntries(allPapers.map(p => [p.id, p]));

        // ── 6. Copy ALL components, recalculating each with live machine/paper data
        let subTotal = 0;

        for (const detail of sourceDetails) {
            const machine = machineMap[detail.machine_id] || null;
            const paper   = paperMap[detail.paper_id]     || null;
            const compFinishings = finishingsByDetail[detail.id] || [];

            // Run calculation with real machine sheet factor (same as item edit page)
            const compParams = {
                quantity:               parseInt(sourceItem.quantity),
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
                customPlateCount:       detail.custom_plate_count,
                machineSheetFactor:     machine ? parseFloat(machine.sheet_factor) || 1.0 : 1.0,
                machineSpeed:           machine ? parseFloat(machine.speed)        || 0   : 0,
                machineSpeedUnit:       machine ? machine.speed_unit || 'Sheets/Hr'       : 'Sheets/Hr',
                paperWidthCm:           paper ? parseFloat(paper.width)  || 0 : (detail.paper_width_cm  || 0),
                paperHeightCm:          paper ? parseFloat(paper.height) || 0 : (detail.paper_height_cm || 0),
                cutWidthCm:             detail.cut_width_cm,
                cutHeightCm:            detail.cut_height_cm,
                digitalPricePerSqCm:    detail.digital_price_per_sq_cm || 0,
                finishings:             compFinishings,
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

            // Insert new detail row with freshly calculated values
            const [detRes] = await pool.execute(
                `INSERT INTO quotation_item_details (
                    quotation_item_id, component_name, type, machine_id, pages, paper_cost_per_sheet,
                    plate_cost_unit, impression_cost_unit, wastage_percent, ups, sides, size, colors, colors_front, colors_back,
                    custom_impressions, custom_wastage_sheets, custom_plate_count,
                    printed_sheets, full_sheets_used, wastage_sheets, total_sheets, plate_count,
                    final_paper_cost, final_plate_cost, final_printing_cost, final_finishing_cost,
                    paper_id, paper_name, paper_width_cm, paper_height_cm,
                    comp_width_cm, comp_height_cm, cut_width_cm, cut_height_cm,
                    bleed_mm, digital_price_per_sq_cm, color_quality, is_bb, custom_sheet_factor
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newItemId,
                    detail.component_name || 'Main',
                    detail.type,
                    detail.machine_id || null,
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
                    detail.custom_impressions || null,
                    detail.custom_wastage_sheets != null ? parseInt(detail.custom_wastage_sheets) : null,
                    detail.custom_plate_count != null ? parseInt(detail.custom_plate_count) : null,
                    result.printedSheets    || 0,
                    result.fullSheetsUsed   || 0,
                    result.wastageSheets    || 0,
                    result.totalSheetsRequired || 0,
                    result.plateCount       || 0,
                    result.costs.paper      || 0,
                    result.costs.plate      || 0,
                    result.costs.printing   || 0,
                    result.costs.finishing  || 0,
                    detail.paper_id   || null,
                    detail.paper_name || null,
                    detail.paper_width_cm  || null,
                    detail.paper_height_cm || null,
                    detail.comp_width_cm   || null,
                    detail.comp_height_cm  || null,
                    detail.cut_width_cm    || null,
                    detail.cut_height_cm   || null,
                    detail.bleed_mm        || 3.00,
                    detail.digital_price_per_sq_cm || null,
                    detail.color_quality   || null,
                    detail.is_bb ? 1 : 0,
                    detail.custom_sheet_factor != null ? parseFloat(detail.custom_sheet_factor) : null,
                ]
            );
            const newDetailId = detRes.insertId;

            // Copy finishings for this component (with recalculated quantities/costs)
            for (const f of result.computedFinishings) {
                await pool.execute(
                    `INSERT INTO quotation_item_finishings
                     (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost,
                      machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        newItemId, newDetailId,
                        f.name, f.quantity, f.unit_cost, f.total_cost,
                        f.machine_id || null, f.is_machine ? 1 : 0,
                        f.time_per_unit || 0, f.total_time || 0,
                        f.cost_unit || 'Unit',
                        f.forms != null ? parseInt(f.forms) : null,
                    ]
                );
            }
        }

        // ── 7. Copy global finishings ────────────────────────────────────────────
        for (const f of globalFinishings) {
            await pool.execute(
                `INSERT INTO quotation_item_finishings
                 (quotation_item_id, quotation_item_detail_id, name, quantity, unit_cost, total_cost,
                  machine_id, is_machine, time_per_unit, total_time, cost_unit, forms)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newItemId, null,
                    f.name, f.quantity, f.unit_cost, f.total_cost,
                    f.machine_id || null, f.is_machine ? 1 : 0,
                    f.time_per_unit || 0, f.total_time || 0,
                    f.cost_unit || 'Unit',
                    f.forms != null ? parseInt(f.forms) : null,
                ]
            );
        }

        // ── 8. Apply existing tax mode on fresh base cost ────────────────────────
        const globalFinishingCost = globalFinishings.reduce((s, f) => s + parseFloat(f.total_cost || 0), 0);
        const markupPct    = parseFloat(sourceItem.markup_percent) || 0;
        const preMarkup    = subTotal + globalFinishingCost;
        const baseCost     = preMarkup + preMarkup * (markupPct / 100);

        const [settingsRows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'default_tax_percentage'"
        );
        const defaultTaxRate = settingsRows.length ? parseFloat(settingsRows[0].setting_value) || 0 : 0;

        const taxMode = sourceItem.tax_mode || 'none';
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

        await pool.execute(
            `UPDATE quotation_items
             SET total_amount=?, subtotal_amount=?, tax_amount=?, tax_percentage=?
             WHERE id=?`,
            [finalTotal, subtotalAmount, taxAmount, defaultTaxRate, newItemId]
        );

        // ── 9. Link new item to this quotation ───────────────────────────────────
        const [orderRows] = await pool.execute(
            'SELECT MAX(display_order) as maxOrder FROM quotation_line_items WHERE quotation_id = ?', [id]
        );
        const maxOrder = orderRows[0].maxOrder || 0;
        await pool.execute(
            'INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order) VALUES (?, ?, ?)',
            [id, newItemId, maxOrder + 1]
        );

        // ── 10. Update quotation grand total ─────────────────────────────────────
        const [qItems] = await pool.execute(
            `SELECT qi.total_amount FROM quotation_items qi
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             WHERE qli.quotation_id = ?`, [id]
        );
        const newTotal = qItems.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
        await pool.execute('UPDATE quotations SET total_amount = ? WHERE id = ?', [newTotal, id]);

        return NextResponse.json({ success: true, newItemId, newTotal });

    } catch (error) {
        console.error('Duplicate Item Error:', error);
        return NextResponse.json({ error: 'Failed to duplicate item', details: error.message }, { status: 500 });
    }
}
