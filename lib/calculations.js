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

/**
 * Calculate Run Qty based on Speed Unit:
 *  Prints/Hr   → totalCutSheets × sides
 *  Sheets/Hr   → if BB: totalCutSheets × (ups × sides / pages)
 *                if not BB: totalCutSheets / (sheets || 1)
 *  Units/Hr    → Units (itemQty)
 */
export function resolveRunQty(speedUnit, { totalCutSheets = 0, sides = 1, isBB = false, ups = 1, pages = 1, sheets = 1, qty = 0, totalImpressions = 0 } = {}) {
    const u = (speedUnit || 'Sheets/Hr').toLowerCase().trim();
    const sidesVal = parseInt(sides) || 1;
    const upsVal = parseInt(ups) || 1;
    const pagesVal = parseInt(pages) || 1;
    const sheetsVal = parseFloat(sheets) || 1;
    const itemQty = parseFloat(qty) || 0;

    if (u === 'prints/hr') {
        return totalCutSheets * sidesVal;
    }
    if (u === 'sheets/hr') {
        if (isBB) {
            return totalCutSheets * ((upsVal * sidesVal) / pagesVal);
        } else {
            return totalCutSheets / sheetsVal;
        }
    }
    if (u === 'impressions/hr') {
        return totalImpressions || (totalCutSheets * sidesVal);
    }
    return itemQty;
}

/**
 * Unified speed-unit time helper (returns hours).
 * Formula: ((Run Qty * Multiplier) / Speed)
 */
export function calcTimeHours(speed, unit, params = {}) {
    if (!speed || speed <= 0) return 0;
    const runQty = resolveRunQty(unit, params);
    const multiplier = parseFloat(params.multiplier) || 1;
    return (runQty * multiplier) / speed;
}
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
    customSheetFactor,  // manual override for cut sheets per full sheet
    customPlateCount,
    custom_plate_count,
    makeReadyMinutes,
    custom_make_ready_minutes,
    setup_minutes_per_plate,
    setupMinutesPerPlate
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
    const customWasteVal = parseInt(customWastageSheets ?? custom_wastage_sheets);
    const wastageCutSheets = (!isNaN(customWasteVal) && customWasteVal >= 0)
        ? customWasteVal * (pagesVal / (upsVal * sidesVal))
        : wastePct;
    const totalCutSheets = Math.ceil(cutSheets + wastageCutSheets);

    // 3. Full Sheets (The parent paper from inventory)
    // User Requirement: "Cut sheets must be multiply by the machine sheet factor"
    // Full Sheets used formula
    const fullSheetsUsed = totalCutSheets / factor;

    const impressions = totalCutSheets * (colorsFront + colorsBack);

    // 4. Printed Sheets (Impressions / Passes)
    // Formula: CutSheets * Sides * Colors (Total Impressions)
    // Since CutSheets is now (Content / Sides), this means Impressions remains based on content surface area.
    const customImpVal = parseInt(customImpressions || custom_impressions);
    const TotalImpressions = (!isNaN(customImpVal) && customImpVal > 0)
        ? customImpVal
        : Math.ceil(impressions);

    // 5. Total Sheets Required (Inventory Check)
    // Full Sheets is already total required because it derived from (Cut + Waste)
    const totalSheetsRequired = Math.ceil(fullSheetsUsed);

    // 5. Plate Count Formula: forms × totalColours
    // forms = distinct sheet layouts = pages / (ups × sides)
    // This matches the cut-sheet divisor so a 2-page double-sided cover at 1-up = 1 form.
    // plateCount = forms × (frontColors + backColors)
    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
    let plateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);

    // Apply manual override if customPlateCount / custom_plate_count is provided
    const customPlateVal = parseInt(customPlateCount ?? custom_plate_count);
    if (!isNaN(customPlateVal) && customPlateVal >= 0) {
        plateCount = customPlateVal;
    }

    // COSTS
    const paperCost = totalSheetsRequired * (parseFloat(paperCostPerSheet) || 0);
    const plateCost = plateCount * (parseFloat(plateCostPerUnit) || 0);

    // --- Impression Cost Logic Block ---
    let printingCost = 0;
    const formsForImpressionCost = pagesVal / (upsVal * sidesVal);
    const impCostUnit = parseFloat(impressionCostPerUnit) || 0;

    const sideMultiplier = isBB ? 2 : 1;
    const colorMultiplier = isBB ? Number(colorsFront || 0) : (Number(colorsFront || 0) + Number(colorsBack || 0));

    // Calculate exact impressions for the run
    const exactImpressions = formsForImpressionCost * qty * sideMultiplier;

    // Round the total impressions up to the nearest 1,000 per form base
    const impressionUnits = Math.ceil(exactImpressions / 1000) * colorMultiplier;

    // If the shop rounds up the sheet batch run before splitting forms
    const adjustedUnits = Math.ceil((formsForImpressionCost * (Math.ceil(qty / 1000) * 1000) * sideMultiplier) / 1000) * colorMultiplier;

    // Final decision logic depending on your print shop's rounding rules
    printingCost = adjustedUnits * impCostUnit;
    // ------------------------------------

    // PRINTING TIME
    let printingTime = 0;
    if (machineSpeed && parseFloat(machineSpeed) > 0) {
        printingTime = calcTimeHours(parseFloat(machineSpeed), machineSpeedUnit, {
            totalCutSheets,
            sides: sidesVal,
            impressions: TotalImpressions,
            qty
        });
    }

    const baseMakeReady = parseFloat(custom_make_ready_minutes ?? makeReadyMinutes) || 0;
    const plateSetupMins = (parseInt(plateCount) || 0) * (parseFloat(setup_minutes_per_plate ?? setupMinutesPerPlate) || 0);
    const makeReady = baseMakeReady + plateSetupMins;
    const setupTimeHours = makeReady / 60;

    // Finishing Cost
    let finishingCost = 0;
    let computedFinishings = [];
    let finishingTime = 0;

    if (Array.isArray(finishings)) {
        computedFinishings = finishings.map(item => {
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
                const cutW = parseFloat(compWidthCm) || 0;
                const cutH = parseFloat(compHeightCm) || 0;
                const widthInches = ((cutW / 2.54) + 0.5);
                const heightInches = ((cutH / 2.54) + 0.5);
                const sqInQty = widthInches * heightInches * (qty + (wastageCutSheets));
                console.log(widthInches);
                console.log(heightInches);
                console.log(qty);
                console.log(wastageCutSheets);
                console.log(sqInQty);
                //const sqInQty = widthInches * heightInches * (totalCutSheets / ups);
                //unitQty = Math.round(sqInQty * 100) / 100;
                unitQty = sqInQty;
            } else {
                unitQty = Math.ceil(qty);
            }

            const total = unitQty * (parseFloat(item.unit_cost) || 0);

            // Time Calculation (Offset Finishing)
            let totalTime = 0;
            if (item.speed && (parseFloat(item.speed) > 0)) {
                totalTime = calcTimeHours(parseFloat(item.speed), item.speed_unit, {
                    totalCutSheets,
                    sides: sidesVal,
                    impressions: TotalImpressions,
                    qty
                });
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
    const totalTime = printingTime + finishingTime + setupTimeHours;

    return {
        type: 'offset',
        pages,
        TotalImpressions,
        cutSheets,
        fullSheetsUsed,
        wastageSheets: wastageCutSheets,
        totalSheetsRequired,
        plateCount,
        customImpressions: (!isNaN(customImpVal) && customImpVal > 0) ? customImpVal : null,
        customWastageSheets: (!isNaN(customWasteVal) && customWasteVal >= 0) ? customWasteVal : null,
        customPlateCount: (!isNaN(customPlateVal) && customPlateVal >= 0) ? customPlateVal : null,
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
            setup: isFinishingComp ? 0 : setupTimeHours,
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
    pages,
    ups,
    pressUps,
    customSheetFactor,
    sides,
    paperCostPerSheet,
    paperWidthCm,
    paperHeightCm,
    digitalPricePerSqCm,
    digitalPricePerUnit,
    digitalImpressionCost,
    impressionCostPerUnit,
    machineSpeed,
    machineSpeedUnit,
    makeReadyMinutes,
    custom_make_ready_minutes,
    finishings = [],
    cutWidthCm,
    cutHeightCm,
    compWidthCm,
    compHeightCm,
    bleedMm = 3,
    compName
}) {
    const qty = parseInt(quantity) || 0;
    const sidesVal = parseInt(sides) || 1;
    let pagesVal = parseInt(pages) || 1;
    if (sidesVal === 2 && pagesVal < 2) {
        pagesVal = 2;
    }
    const upsVal = parseInt(ups) || 1;
    const pressUpsVal = parseFloat(pressUps) || parseFloat(customSheetFactor) || 1.0;
    const bleedVal = (bleedMm != null && bleedMm !== '') ? parseFloat(bleedMm) : 3;
    const bleedCm = bleedVal / 10; // convert mm to cm

    const totalPages = pagesVal * qty;
    const divisor = upsVal * sidesVal;
    const cutSheets = divisor > 0 ? Math.ceil(totalPages / divisor) : 0;
    const TotalImpressions = Math.ceil(totalPages / upsVal);
    const wastageCutSheets = 0;
    const totalCutSheets = cutSheets;

    // User Formulas:
    // stock sheets used = print pages / sidesVal / (press ups * ups) * qty
    // press sheets used = print pages / sidesVal / ups * qty
    const totalUpsPerStockSheet = (pressUpsVal * upsVal * sidesVal) > 0 ? (pressUpsVal * upsVal * sidesVal) : 1;
    const stockSheetsUsed = (pagesVal / totalUpsPerStockSheet) * qty;
    const pressSheetsUsed = (upsVal * sidesVal) > 0 ? (pagesVal / sidesVal / upsVal) * qty : 0;
    const stockSheetsRequired = stockSheetsUsed;
    const stockSheetPrice = parseFloat(paperCostPerSheet) || 0;
    const paperCost = stockSheetsUsed * stockSheetPrice;

    // Dimensions & Pricing (Incorporate bleed dimension adjustment into effective component width & height)
    const rawWidth = parseFloat(compWidthCm) || parseFloat(cutWidthCm) || parseFloat(paperWidthCm) || 0;
    const rawHeight = parseFloat(compHeightCm) || parseFloat(cutHeightCm) || parseFloat(paperHeightCm) || 0;
    const width = rawWidth > 0 ? rawWidth + (2 * bleedCm) : 0;
    const height = rawHeight > 0 ? rawHeight + (2 * bleedCm) : 0;
    const priceSqCm = parseFloat(digitalPricePerSqCm) || 0;
    const unitPriceInput = parseFloat(digitalPricePerUnit) || 0;
    const impCostUnit = parseFloat(impressionCostPerUnit ?? digitalImpressionCost) || 0;

    // Print cost formula: print cost = digitalPricePerUnit * pages * qty
    let pricePerUnit = 0;
    if (unitPriceInput > 0) {
        pricePerUnit = unitPriceInput;
    } else if (priceSqCm > 0 && width > 0 && height > 0) {
        pricePerUnit = priceSqCm * width * height * upsVal * sidesVal;
    } else if (impCostUnit > 0) {
        pricePerUnit = impCostUnit;
    }

    const printingCost = pricePerUnit * pressSheetsUsed;

    // PRINTING TIME (Digital)
    let printingTime = 0;
    if (machineSpeed && parseFloat(machineSpeed) > 0) {
        printingTime = calcTimeHours(parseFloat(machineSpeed), machineSpeedUnit, {
            totalCutSheets: TotalImpressions,
            sides: sidesVal,
            impressions: TotalImpressions * sidesVal,
            qty
        });
    }

    const makeReady = parseFloat(custom_make_ready_minutes ?? makeReadyMinutes) || 0;
    const setupTimeHours = makeReady / 60;

    // Finishing Cost
    let finishingCost = 0;
    let computedFinishings = [];
    let finishingTime = 0;

    if (Array.isArray(finishings)) {
        computedFinishings = finishings.map(item => {
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
                const cutW = (parseFloat(compWidthCm) || parseFloat(cutWidthCm) || 0) + (2 * bleedCm);
                const cutH = (parseFloat(compHeightCm) || parseFloat(cutHeightCm) || 0) + (2 * bleedCm);
                const widthInches = ((cutW / 2.54) + 0.5);
                const heightInches = ((cutH / 2.54) + 0.5);
                const sqInQty = widthInches * heightInches * (qty + wastageCutSheets);
                unitQty = sqInQty;
            } else {
                unitQty = Math.ceil(qty);
            }

            const total = unitQty * (parseFloat(item.unit_cost) || 0);

            // Time Calculation (Digital Finishing)
            let totalTime = 0;
            if (item.speed && (parseFloat(item.speed) > 0)) {
                totalTime = calcTimeHours(parseFloat(item.speed), item.speed_unit, {
                    totalCutSheets,
                    sides: sidesVal,
                    impressions: TotalImpressions,
                    qty
                });
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
    const totalTime = printingTime + finishingTime + setupTimeHours;

    return {
        type: 'digital',
        TotalImpressions,
        cutSheets: pressSheetsUsed,
        printedSheets: TotalImpressions,
        pressSheetsUsed,
        stockSheetsUsed,
        fullSheetsUsed: stockSheetsUsed,
        totalSheetsRequired: stockSheetsUsed,
        pressUps: pressUpsVal,
        wastageSheets: 0,
        plateCount: 0,
        costs: {
            paper: isFinishingComp ? 0 : paperCost,
            plate: 0,
            printing: isFinishingComp ? 0 : printingCost,
            finishing: finishingCost,
            total: totalCost
        },
        time: {
            printing: isFinishingComp ? 0 : printingTime,
            finishing: finishingTime,
            setup: isFinishingComp ? 0 : setupTimeHours,
            total: totalTime
        },
        computedFinishings
    };
}