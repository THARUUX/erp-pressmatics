import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateOffset, calculateDigital } from '@/lib/calculations';

export async function POST(req, { params }) {
    try {
        const { id, itemId } = await params;
        const body = await req.json();
        console.log(`[Recalc API] ID: ${itemId}, Body:`, body);
        let { quantity, estimation_name, tax_mode } = body;

        // 1. Fetch Item & Details
        const [items] = await pool.execute('SELECT * FROM quotation_items WHERE id = ?', [itemId]);
        if (items.length === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        const item = items[0];

        // If quantity not provided, use existing
        if (!quantity) {
            quantity = item.quantity;
        }

        // If only updating name
        if (estimation_name && !quantity && !tax_mode) {
            // ... existing name update logic? 
            // Actually, if we have quantity (defaulted), we can just follow full flow? 
            // But existing shortcut was optimizing. 
            // If ONLY name is passed, we might want to skip full recalc.
        }

        // Simplified Logic: Always full recalc unless purely name change with no other changes?
        // But invalid quantity check needs to be AFTER fetching item now.

        if (!quantity && !estimation_name && !tax_mode) {
            return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
        }

        // Shortcut for name only update
        if (estimation_name && quantity == item.quantity && !tax_mode) {
            await pool.execute('UPDATE quotation_items SET estimation_name = ? WHERE id = ?', [estimation_name, itemId]);
            return NextResponse.json({ success: true });
        }

        const [details] = await pool.execute('SELECT * FROM quotation_item_details WHERE quotation_item_id = ?', [itemId]);
        const detail = details.length > 0 ? details[0] : null;

        const [finishings] = await pool.execute('SELECT * FROM quotation_item_finishings WHERE quotation_item_id = ?', [itemId]);

        let result;

        if (item.type === 'offset' && detail) {
            result = calculateOffset({
                quantity: quantity,
                pages: detail.pages,
                ups: detail.ups,
                sides: detail.sides,
                colors: detail.colors,
                paperCostPerSheet: detail.paper_cost_per_sheet,
                plateCostPerUnit: detail.plate_cost_unit,
                impressionCostPerUnit: detail.impression_cost_unit,
                wastagePercent: detail.wastage_percent,
                machineSheetFactor: 1, // We don't have this stored explicitly per se, usually derived from paper size map in memory?
                // Wait, in previous flow `machineSheetFactor` was passed from UI. 
                // We stored details.full_sheets_used = totalCutSheets / factor. 
                // Can we reverse calc it? factor = totalCutSheets / full_sheets_used.
                // Or safely assume standard factors if not stored?
                // Ideally we should have stored `machineSheetFactor` in details.
                // Checking schema... we verified `machineSheetFactor` is NOT in `quotation_item_details`.
                // However, we have `full_sheets_used` and `total_sheets` (which includes wastage).
                // Let's deduce factor. 
                // cutSheets (from prev calc) = (Pages * Qty) / (Ups * Sides).
                // totalCutSheets = cutSheets + Waste.
                // factor = totalCutSheets / full_sheets_used.

                // Hack: If we don't have it, try to re-use 1 if undefined, or deduce.
                // Let's assume factor 1 for now or try to deduce if possible. 
                // Impact: Only affects full_sheets_used and Paper Cost if factor != 1.
                // If the original calculation used factor=2 (e.g. 2 up on sheet), then passing 1 will double the paper cost!
                // We MUST approximate it.

                finishings: finishings.map(f => ({
                    ...f,
                    // If cost_unit is 'Unit', we don't change unit_cost.
                    // If 'Page' or 'Cut Sheet', logic expects them.
                    // `calculateOffset` re-calcs total_cost based on new Qty and basis.
                }))
            });

            // Recover factor logic
            // oldCutSheets = (detail.pages * item.quantity) / (detail.ups * detail.sides);
            // oldWaste = detail.wastage_sheets; 
            // oldTotalCut = oldCutSheets + oldWaste; // approx
            // oldFull = detail.full_sheets_used;
            // estFactor = oldTotalCut / oldFull;

            // Let's try to pass this Estimated Factor
            const oldQty = item.quantity;
            const oldCutSheets = (detail.pages * oldQty) / (detail.ups * detail.sides);
            // We don't have exact oldCutSheets stored, only total (but total has waste).
            // Let's rely on basic formula.
            let estFactor = 1;
            if (detail.full_sheets_used > 0) {
                // Re-calculate old theoretical cut sheets
                const theoreticaloldCut = (detail.pages * oldQty) / (detail.ups * detail.sides);
                // We need to account for waste to get 'totalCut'.
                // waste = ceil(cut * percent/100).
                const waste = Math.ceil(theoreticaloldCut * (detail.wastage_percent / 100));
                const totalCut = Math.ceil(theoreticaloldCut + waste);
                estFactor = totalCut / detail.full_sheets_used;
            }

            // Re-run with estimated factor
            result = calculateOffset({
                quantity: quantity,
                pages: detail.pages,
                ups: detail.ups,
                sides: detail.sides,
                colors: detail.colors,
                paperCostPerSheet: detail.paper_cost_per_sheet,
                plateCostPerUnit: detail.plate_cost_unit,
                impressionCostPerUnit: detail.impression_cost_unit,
                wastagePercent: detail.wastage_percent,
                machineSheetFactor: estFactor || 1,
                finishings: finishings
            });


        } else if (item.type === 'digital' && detail) {
            result = calculateDigital({
                quantity: quantity,
                ups: detail.ups || 1,
                impressionCostPerUnit: detail.impression_cost_unit, // mapped to printing cost usually?
                // Digital detail schema check?
                // details table column 'impression_cost_unit' is likely used for digital click cost too?
                // Yes, generic schema.
                finishings: finishings
            });
        } else {
            return NextResponse.json({ error: 'Invalid item type or missing details' }, { status: 400 });
        }

        // 2. Update Database

        // Fetch Default Tax Percentage
        const [settings] = await pool.execute("SELECT setting_value FROM settings WHERE setting_key = 'default_tax_percentage'");
        const defaultTaxRate = settings.length > 0 ? parseFloat(settings[0].setting_value) || 0 : 0;

        // const { tax_mode } = body; // Already destuctured at top


        let currentTaxMode = tax_mode;
        if (!currentTaxMode) {
            // If not provided, fetch current
            currentTaxMode = item.tax_mode || 'none';
        }

        // Calculate Tax
        const subtotal = result.costs.total;
        let taxAmount = 0;
        let finalTotal = subtotal;

        if (currentTaxMode !== 'none' && defaultTaxRate > 0) {
            taxAmount = subtotal * (defaultTaxRate / 100);
            if (currentTaxMode === 'add') {
                finalTotal = subtotal + taxAmount;
            } else if (currentTaxMode === 'deduct') {
                finalTotal = subtotal - taxAmount;
            }
        }

        // 2. Update Database

        // Update Item with Tax Info
        await pool.execute('UPDATE quotation_items SET quantity = ?, total_amount = ?, estimation_name = COALESCE(?, estimation_name), subtotal_amount = ?, tax_amount = ?, tax_percentage = ?, tax_mode = ? WHERE id = ?',
            [quantity, finalTotal, estimation_name || null, subtotal, taxAmount, defaultTaxRate, currentTaxMode, itemId]
        );

        // Update Details logic (unchanged)... except we don't need to change details logic as it calculates sub-costs which sum up to subtotal.
        // ... (lines 131-155 unchanged in replaced block logic, but I need to include them if I span across them)
        // I will just perform the DB update for Item here and let the existing Details update logic run below.

        // Wait, I replaced the Update Item block. I must ensure the Details block follows.

        // ... Details Update Block ... (I need to keep the code I'm *not* replacing if I use Replace, but I am replacing the UPDATE query)

        if (item.type === 'offset') {
            // ... existing Offset Details Update ...
            await pool.execute(`
                UPDATE quotation_item_details SET 
                    printed_sheets = ?, full_sheets_used = ?, wastage_sheets = ?, total_sheets = ?,
                    plate_count = ?, final_paper_cost = ?, final_plate_cost = ?, final_printing_cost = ?, final_finishing_cost = ?
                WHERE quotation_item_id = ?`,
                [
                    result.printedSheets, result.fullSheetsUsed, result.wastageSheets, result.totalSheetsRequired,
                    result.plateCount, result.costs.paper, result.costs.plate, result.costs.printing, result.costs.finishing,
                    itemId
                ]
            );
        } else {
            // ... existing Digital Details Update ...
            await pool.execute(`
                UPDATE quotation_item_details SET 
                    printed_sheets = ?, final_printing_cost = ?, final_finishing_cost = ?
                WHERE quotation_item_id = ?`,
                [
                    result.printedSheets, result.costs.printing, result.costs.finishing,
                    itemId
                ]
            );
        }

        // ... Finishings Update ... (unchanged)
        for (const f of result.computedFinishings) {
            if (f.id) {
                await pool.execute('UPDATE quotation_item_finishings SET quantity = ?, total_cost = ? WHERE id = ?',
                    [f.quantity, f.total_cost, f.id]
                );
            }
        }

        // 3. Update Quotation Total
        const [qItems] = await pool.execute(`
            SELECT qi.total_amount 
            FROM quotation_items qi
            JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
            WHERE qli.quotation_id = ?
        `, [id]);
        const newTotal = qItems.reduce((sum, i) => sum + parseFloat(i.total_amount), 0);

        await pool.execute('UPDATE quotations SET total_amount = ? WHERE id = ?', [newTotal, id]);

        return NextResponse.json({ success: true, newTotal, itemTotal: result.costs.total });

    } catch (error) {
        console.error("Recalculate Error:", error);
        return NextResponse.json({ error: 'Failed to recalculate', details: error.message }, { status: 500 });
    }
}
