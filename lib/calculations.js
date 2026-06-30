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
    customSheetFactor,  // manual override for cut sheets per full sheet
    customPlateCount,
    custom_plate_count
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
    // Full Sheets used formula
    const fullSheetsUsed = totalCutSheets / factor;

    const impressions = pagesVal * (qty <= 1000 ? 1000 : qty) / (sidesVal * upsVal) * colorsVal * sidesVal;

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

    // 5. Plate Count Formula: forms × totalColours
    // forms = distinct sheet layouts = pages / (ups × sides)
    // This matches the cut-sheet divisor so a 2-page double-sided cover at 1-up = 1 form.
    // plateCount = forms × (frontColors + backColors)
    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
    let plateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);

    // Apply manual override if customPlateCount / custom_plate_count is provided
    const customPlateVal = parseInt(customPlateCount || custom_plate_count);
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

    // Helper function to calculate impression cost for a specific quantity segment
    function calculateSegmentCost(targetQty) {
        const sideMultiplier = isBB ? 2 : 1;
        const colorMultiplier = isBB ? Number(colorsFront || 0) : (Number(colorsFront || 0) + Number(colorsBack || 0));
        
        // Calculate impression count per thousand
        const impressionCount = Math.ceil((formsForImpressionCost * targetQty * sideMultiplier) / 1000) * colorMultiplier;
        return impressionCount * impCostUnit;
    }

    // Execute logic based on whether quantity is cleanly divisible by 1000
    if (qty % 1000 === 0) {
        printingCost = calculateSegmentCost(qty);
    } else {
        const devQty = Math.floor(qty / 1000) * 1000;
        const remQty = Math.ceil((qty % 1000) / 1000) * 1000;
        console.log("devQty", devQty);
        console.log("remQty", remQty);
        const printImpCost1 = devQty > 0 ? calculateSegmentCost(devQty) : 0;
        const printImpCost2 = remQty > 0 ? calculateSegmentCost(remQty) : 0;
        printingCost = printImpCost1 + printImpCost2;
    }
    // ------------------------------------

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
                const speed = parseFloat(item.speed);
                const speedUnit = item.speed_unit || 'Sheets/Hr'; 

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
    sides,                
    paperCostPerSheet,    
    paperWidthCm,         
    paperHeightCm,         
    digitalPricePerSqCm,  
    machineSpeed, 
    machineSpeedUnit, 
    finishings = [],
    cutWidthCm,
    cutHeightCm,
    compWidthCm,
    compHeightCm,
    compName
}) {
    const qty = parseInt(quantity) || 0;
    const upsVal = parseInt(ups) || 1;
    const sidesVal = parseInt(sides) || 1; 

    const printedSheets = Math.ceil(qty / upsVal);

    // Core costs
    const paperCost = printedSheets * (parseFloat(paperCostPerSheet) || 0);
    const width = parseFloat(paperWidthCm) || 0;
    const height = parseFloat(paperHeightCm) || 0;
    const priceSqCm = parseFloat(digitalPricePerSqCm) || 0;

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

            if (costUnit === 'Page') {
                unitQty = qty; // Digital fallback logic
            } else if (costUnit === 'Cut Sheet') {
                unitQty = printedSheets;
            } else if (costUnit === 'Form') {
                const itemForms = parseInt(item.forms) || 1;
                unitQty = itemForms * qty;
            } else if (costUnit === 'SqInch') {
                const cutW = parseFloat(compWidthCm) || 0;
                const cutH = parseFloat(compHeightCm) || 0;
                const widthInches = cutW / 2.54;
                const heightInches = cutH / 2.54;
                // Fixed Reference Error: replaced non-existent wastageCutSheets variable with 0 for digital calculations
                const sqInQty = widthInches * heightInches * qty; 
                unitQty = Math.round(sqInQty * 100) / 100;
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
                    totalTime = printedSheets / speed;
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