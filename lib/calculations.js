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
    colors,       // legacy fallback
    colorsFront,  // front ink colours
    colorsBack,   // back ink colours
    paperCostPerSheet,
    plateCostPerUnit,
    impressionCostPerUnit, // optional
    wastagePercent,
    machineSheetFactor,
    machineSpeed, // New
    machineSpeedUnit, // New
    finishings = [],
    customImpressions,
    custom_impressions,
    customWastageSheets,
    custom_wastage_sheets,
    cutWidthCm,
    cutHeightCm,
    compWidthCm,
    compHeightCm,
    compName,
    isBB = false,
    customSheetFactor  // manual override for cut sheets per full sheet
}) {
    // Validate basic inputs
    const qty = parseInt(quantity) || 0;
    const pagesVal = parseInt(pages) || 1;
    const upsVal = parseInt(ups) || 1;
    const sidesVal = parseInt(sides) || 1;
    // Derive total color count from front+back if provided, else fall back to legacy `colors`
    const hasSplitColors = (colorsFront != null || colorsBack != null);
    const colorsVal = hasSplitColors
        ? (parseInt(colorsFront) || 0) + (parseInt(colorsBack) || 0)
        : (parseInt(colors) || 4);
    const factor = parseFloat(customSheetFactor) || parseFloat(machineSheetFactor) || 1.0;
    const wastePct = parseFloat(wastagePercent) || 0;

    // 1. Cut Sheets (The paper feeding the machine)
    // Formula: (Pages * Qty) / (Ups * Sides)
    // "Pages" input is treated as "Content Pages per Item".
    const totalPages = pagesVal * qty;
    const divisor = upsVal * sidesVal;
    const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;

    // 2. Wastage (on Cut Sheets)
    // User Requirement: "Input for wastage percentage, and it should be for cut sheets"
    // If customWastageSheets is set, use it directly instead of the percentage calculation.
    const customWasteVal = parseInt(customWastageSheets || custom_wastage_sheets);
    const wastageCutSheets = (!isNaN(customWasteVal) && customWasteVal >= 0)
        ? customWasteVal * (pagesVal / (upsVal * sidesVal))
        : wastePct;
    const totalCutSheets = Math.ceil(cutSheets + wastageCutSheets);

    // 3. Full Sheets (The parent paper from inventory)
    // User Requirement: "Cut sheets must be multiply by the machine sheet factor"
    const fullSheetsUsed = totalCutSheets / factor;

    const impressions = pagesVal * (qty <= 1000 ? 1000 : qty) / (sidesVal * upsVal) * colorsVal * sidesVal;
    //console.log("sides", sidesVal);

    // 4. Printed Sheets (Impressions / Passes)
    // Formula: CutSheets * Sides * Colors (Total Impressions)
    // Since CutSheets is now (Content / Sides), this means Impressions remains based on content surface area.
    const customImpVal = parseInt(customImpressions || custom_impressions);
    const printedSheets = (!isNaN(customImpVal) && customImpVal > 0)
        ? customImpVal
        : Math.ceil(impressions);

    // 5. Total Sheets Required (Inventory Check)
    // Full Sheets is already total required because it derived from (Cut + Waste)
    const totalSheetsRequired = Math.ceil(fullSheetsUsed);

    const invertedSideVal = sidesVal === 2 ? 1 : 2;

    // 5. Plate Count Formula: forms × totalColours
    // forms = distinct sheet layouts = pages / (ups × sides)
    // This matches the cut-sheet divisor so a 2-page double-sided cover at 1-up = 1 form.
    // plateCount = forms × (frontColors + backColors)
    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
    const plateCount = isBB ? 1 : (forms * colorsVal);

    // COSTS
    const paperCost = totalSheetsRequired * (parseFloat(paperCostPerSheet) || 0);
    // Plate cost usually per whole plate? 7.5 plates * cost? 
    // Assuming user wants exact calc match.
    const plateCost = plateCount * (parseFloat(plateCostPerUnit) || 0);

    // Impression Cost
    const printingCost = (qty <= 1000 ? plateCount * impressionCostPerUnit : Math.ceil(qty / 1000) * plateCount * impressionCostPerUnit);

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
                unitQty = Math.ceil(cutSheets);
            } else if (costUnit === 'Form') {
                const itemForms = parseInt(item.forms) || 1;
                unitQty = itemForms * qty;
            } else if (costUnit === 'SqInch') {
                const cutW = parseFloat(compWidthCm) || 0;
                const cutH = parseFloat(compHeightCm) || 0;
                const widthInches = cutW / 2.54;
                const heightInches = cutH / 2.54;
                const sqInQty = widthInches * heightInches * (qty + wastageCutSheets);
                unitQty = Math.round(sqInQty * 100) / 100;
            } else {
                unitQty = Math.ceil(qty);
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

    const isFinishingComp = compName === 'Finishing';
    const totalCost = (isFinishingComp ? 0 : paperCost + plateCost + printingCost) + finishingCost;
    const totalTime = printingTime + finishingTime;

    return {
        type: 'offset',
        pages,
        printedSheets,
        cutSheets,
        fullSheetsUsed,
        wastageSheets: wastageCutSheets,
        totalSheetsRequired,
        plateCount,
        customImpressions: (!isNaN(customImpVal) && customImpVal > 0) ? customImpVal : null,
        customWastageSheets: (!isNaN(customWasteVal) && customWasteVal >= 0) ? customWasteVal : null,
        costs: {
            paper: isFinishingComp ? 0 : paperCost,
            plate: isFinishingComp ? 0 : plateCost,
            printing: isFinishingComp ? 0 : printingCost,
            finishing: finishingCost,
            total: totalCost
        },
        time: {
            printing: isFinishingComp ? 0 : printingTime,
            finishing: finishingTime,
            total: totalTime
        },
        computedFinishings
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
    sides,                // New
    paperCostPerSheet,    // New
    paperWidthCm,         // New
    paperHeightCm,        // New
    digitalPricePerSqCm,  // New
    machineSpeed, // New
    machineSpeedUnit, // New
    finishings = [],
    cutWidthCm,
    cutHeightCm,
    compWidthCm,
    compHeightCm,
    compName
}) {
    const qty = parseInt(quantity) || 0;
    console.log('[calculateDigital] called | qty:', qty, '| finishings count:', Array.isArray(finishings) ? finishings.length : 'NOT ARRAY', '| compWidthCm:', compWidthCm, '| compHeightCm:', compHeightCm);
    const upsVal = parseInt(ups) || 1;
    const sidesVal = parseInt(sides) || 1; // Default to single-sided if undefined

    const printedSheets = Math.ceil(qty / upsVal);

    // Core costs
    const paperCost = printedSheets * (parseFloat(paperCostPerSheet) || 0);
    const width = parseFloat(paperWidthCm) || 0;
    const height = parseFloat(paperHeightCm) || 0;
    const priceSqCm = parseFloat(digitalPricePerSqCm) || 0;

    // Print cost = Area in sq cm * price per sq cm * Number of sheets * Sides
    // If double sided, the paper cost stays the same, but the impression/print cost doubles
    const printingCost = printedSheets * width * height * priceSqCm * sidesVal;

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
            console.log('[Finishing] name:', item.name, '| cost_unit (raw):', item.cost_unit, '| resolved costUnit:', costUnit);

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
            } else if (costUnit === 'Form') {
                const itemForms = parseInt(item.forms) || 1;
                unitQty = itemForms * qty;
            } else if (costUnit === 'SqInch') {
                const cutW = parseFloat(compWidthCm) || 0;
                const cutH = parseFloat(compHeightCm) || 0;
                const widthInches = cutW / 2.54;
                const heightInches = cutH / 2.54;
                console.log('[SqInch Digital] widthIn:', widthInches.toFixed(4), '| heightIn:', heightInches.toFixed(4), '| qty:', qty);
                const sqInQty = widthInches * heightInches * (qty + wastageCutSheets);
                unitQty = Math.round(sqInQty * 100) / 100;
                console.log('[SqInch Digital] unitQty:', unitQty);
            } else {
                unitQty = qty;
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

    const isFinishingComp = compName === 'Finishing';
    const totalCost = (isFinishingComp ? 0 : paperCost + printingCost) + finishingCost;
    const totalTime = printingTime + finishingTime;

    return {
        type: 'digital',
        printedSheets,
        costs: {
            paper: isFinishingComp ? 0 : paperCost,
            printing: isFinishingComp ? 0 : printingCost,
            finishing: finishingCost,
            total: totalCost
        },
        time: {
            printing: isFinishingComp ? 0 : printingTime,
            finishing: finishingTime,
            total: totalTime
        },
        computedFinishings
    };
}
