/**
 * Core Quotation Calculation Logic
 */

/*
  OFFSET LOGIC:
  1. Printed Sheets = ceil(Quantity / Ups)
  2. Full Sheets Used = ceil(Printed Sheets * MachineSheetFactor)
  3. Wastage Sheets = ceil(Full Sheets Used * (WastagePercent / 100))
  4. Total Sheets = Full Sheets Used + Wastage Sheets
  5. Plate Count = Colors * Sides
*/
export function calculateOffset({
    quantity,
    pages, // New input
    ups,
    sides,
    colors,
    paperCostPerSheet,
    plateCostPerUnit,
    impressionCostPerUnit, // optional
    wastagePercent,
    machineSheetFactor,
    machineSpeed, // New
    machineSpeedUnit, // New
    finishings = []
}) {
    // Validate basic inputs
    const qty = parseInt(quantity) || 0;
    const pagesVal = parseInt(pages) || 1;
    const upsVal = parseInt(ups) || 1;
    const sidesVal = parseInt(sides) || 1;
    const colorsVal = parseInt(colors) || 4;
    const factor = parseFloat(machineSheetFactor) || 1.0;
    const wastePct = parseFloat(wastagePercent) || 0;

    // 1. Cut Sheets (The paper feeding the machine)
    // Formula: (Pages * Qty) / (Ups * Sides)
    // "Pages" input is treated as "Content Pages per Item".
    const totalPages = pagesVal * qty;
    const divisor = upsVal * sidesVal;
    const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;

    // 2. Wastage (on Cut Sheets)
    // User Requirement: "Input for wastage percentage, and it should be for cut sheets"
    const wastageCutSheets = Math.ceil(cutSheets * (wastePct / 100));
    const totalCutSheets = Math.ceil(cutSheets + wastageCutSheets);

    // 3. Full Sheets (The parent paper from inventory)
    // User Requirement: "Cut sheets must be multiply by the machine sheet factor"
    const fullSheetsUsed = totalCutSheets / factor;

    // 4. Printed Sheets (Impressions / Passes)
    // Formula: CutSheets * Sides * Colors (Total Impressions)
    // Since CutSheets is now (Content / Sides), this means Impressions remains based on content surface area.
    const printedSheets = Math.ceil(totalCutSheets * sidesVal * colorsVal);

    // 5. Total Sheets Required (Inventory Check)
    // Full Sheets is already total required because it derived from (Cut + Waste)
    const totalSheetsRequired = Math.ceil(fullSheetsUsed);

    // 5. Plate Count Formula: (Pages / Ups) * Colours
    // "Pages" is total content pages.
    // If we have distinct content pages, we need plates for each distinct surface.
    // Sides is already accounted for in "Pages" (if we treat pages as content).
    // Example: 10 Pages content. 10 plates (single color).
    // Sides just determines if we print on back or not (reducing paper).
    const forms = upsVal > 0 ? Math.ceil(pagesVal / upsVal) : 0;
    // User Requirement: "plate count should be came by multiplying by the colour count also".
    // Interpreted as ensuring Plate Count accounts for BOTH Colors AND Sides (for front/back plating).
    const plateCount = forms * colorsVal * sidesVal;

    // COSTS
    const paperCost = totalSheetsRequired * (parseFloat(paperCostPerSheet) || 0);
    // Plate cost usually per whole plate? 7.5 plates * cost? 
    // Assuming user wants exact calc match.
    const plateCost = plateCount * (parseFloat(plateCostPerUnit) || 0);

    // Impression Cost
    const printingCost = printedSheets * (parseFloat(impressionCostPerUnit) || 0);

    // PRINTING TIME
    let printingTime = 0;
    if (machineSpeed && parseFloat(machineSpeed) > 0) {
        const speed = parseFloat(machineSpeed);
        const unit = machineSpeedUnit || 'Sheets/Hr';
        if (unit === 'Sheets/Hr') {
            // For Offset, speed is usually Impressions per Hour (Printed Sheets) OR Cut Sheets feed rate? 
            // Usually Impressions per hour (IPH).
            // printedSheets = Total Impressions.
            printingTime = printedSheets / speed;
        } else {
            // Units/Hr -> Job Quantity
            printingTime = qty / speed;
        }
    }

    // Finishing Cost
    let finishingCost = 0;
    let computedFinishings = [];
    let finishingTime = 0; // New accumulator

    if (Array.isArray(finishings)) {
        computedFinishings = finishings.map(item => {
            let unitQty = parseInt(item.quantity) || 0;
            // Recalculate quantity based on cost_unit if not 'Unit' (manual override handling?)
            // Assumption: For estimation, if we pass the basis, we enforce the rule.
            const costUnit = item.cost_unit || 'Unit';

            if (costUnit === 'Page') {
                unitQty = totalPages; // derived earlier (pagesVal * qty)
            } else if (costUnit === 'Cut Sheet') {
                // User Request: "multiply by the total cutsheets (including wastage)"
                unitQty = Math.ceil(totalCutSheets);
            } else {
                // 'Unit' = Job Quantity usually, but user might have manually adjusted it in UI.
                // If it matches exactly job qty, we might strictly enforce it?
                // Let's rely on what UI sends for 'Unit' usually, OR enforce Job Qty?
                // Better to enforce Job Qty if 'Unit' to be safe, unless user intends partial?
                // Current UI defaults it to Job Qty.
                // Let's trust the input quantity for 'Unit' basis, but strictly calc others.
            }

            const total = unitQty * (parseFloat(item.unit_cost) || 0);

            // Time Calculation
            let totalTime = 0;
            if (item.speed && (parseFloat(item.speed) > 0)) {
                // Determine basis for speed
                const speed = parseFloat(item.speed);
                const speedUnit = item.speed_unit || 'Sheets/Hr'; // Default

                if (speedUnit === 'Sheets/Hr') {
                    const sheetCount = Math.ceil(totalCutSheets);
                    totalTime = sheetCount / speed;
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
    }

    const totalCost = paperCost + plateCost + printingCost + finishingCost;
    const totalTime = printingTime + finishingTime;

    return {
        type: 'offset',
        pages,
        printedSheets,
        cutSheets,
        fullSheetsUsed, // Returns decimal
        wastageSheets: wastageCutSheets,
        totalSheetsRequired,
        plateCount, // Returns decimal
        costs: {
            paper: paperCost,
            plate: plateCost,
            printing: printingCost,
            finishing: finishingCost,
            total: totalCost
        },
        time: {
            printing: printingTime,
            finishing: finishingTime,
            total: totalTime
        },
        computedFinishings // Return details so UI can update lists
    };
}

/*
  DIGITAL LOGIC:
  1. Printed Sheets = ceil(Quantity / Ups)
  2. No plates, no complex wastage usually (or minimal).
  3. Cost = Printed Sheets * Impression Cost
*/
export function calculateDigital({
    quantity,
    ups,
    impressionCostPerUnit,
    machineSpeed, // New
    machineSpeedUnit, // New
    finishings = []
}) {
    const qty = parseInt(quantity) || 0;
    const upsVal = parseInt(ups) || 1;

    const printedSheets = Math.ceil(qty / upsVal);
    const printingCost = printedSheets * (parseFloat(impressionCostPerUnit) || 0);

    // PRINTING TIME
    let printingTime = 0;
    if (machineSpeed && parseFloat(machineSpeed) > 0) {
        const speed = parseFloat(machineSpeed);
        const unit = machineSpeedUnit || 'Sheets/Hr';
        if (unit === 'Sheets/Hr') {
            printingTime = printedSheets / speed;
        } else {
            printingTime = qty / speed;
        }
    }

    // Finishing Cost
    let finishingCost = 0;
    let computedFinishings = [];
    let finishingTime = 0;

    if (Array.isArray(finishings)) {
        computedFinishings = finishings.map(item => {
            let unitQty = parseInt(item.quantity) || 0;
            const costUnit = item.cost_unit || 'Unit';

            // Digital logic:
            // Cut Sheet == Printed Sheet (SRA3 etc) usually? Or derived?
            // Digital usually inputs "Job Qty" (final units). "Ups" determines click count.
            // If finishing is per "Cut Sheet", it's same as "Printed Sheets".

            if (costUnit === 'Page') {
                // If pages param exists? Digital doesn't explicitly have pages input in the function signature yet!
                // We need to allow passing 'pages' to digital calc too if we want 'Page' basis.
                // Assuming `item.pages` might be passed or we need to add `pages` to inputs.
                // For now, if missing pages, fallback to qty?
                // Let's assume 'Unit' mostly for digital.
            } else if (costUnit === 'Cut Sheet') {
                // Matching Offset Logic: Net Sheets
                unitQty = printedSheets;
            }

            const total = unitQty * (parseFloat(item.unit_cost) || 0);

            // Time Calculation (Digital)
            let totalTime = 0;
            if (item.speed && (parseFloat(item.speed) > 0)) {
                const speed = parseFloat(item.speed);
                const speedUnit = item.speed_unit || 'Sheets/Hr';

                if (speedUnit === 'Sheets/Hr') {
                    // For digital, printedSheets acts as the sheet count entering post-press
                    totalTime = printedSheets / speed;
                } else {
                    // 'Units/Hr' -> Job Quantity
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
    }

    const totalCost = printingCost + finishingCost;
    const totalTime = printingTime + finishingTime;

    return {
        type: 'digital',
        printedSheets,
        costs: {
            printing: printingCost,
            finishing: finishingCost,
            total: totalCost
        },
        time: {
            printing: printingTime,
            finishing: finishingTime,
            total: totalTime
        },
        computedFinishings // Return details so UI can update lists
    };
}
