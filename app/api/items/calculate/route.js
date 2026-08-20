import { NextResponse } from 'next/server';
import { calculateOffset, calculateDigital } from '@/lib/calculations';

export async function POST(req) {
    try {
        const body = await req.json();

        let components = body.components;
        if (!components && body.params) {
            components = [{
                name: 'Main',
                type: body.type,
                quantity: body.quantity,
                params: body.params,
                finishings: body.finishings || []
            }];
        }

        const results = [];
        let grandTotal = 0;

        for (const comp of components) {
            const isSFGComp = comp.type === 'sfg' || (comp.name || '').toLowerCase().includes('assets') || (comp.name || '').toLowerCase().includes('sfg');
            const isServicesComp = comp.type === 'services' || (comp.name || '').toLowerCase().includes('service');
            let result;

            if (isServicesComp) {
                const servicesCost = (comp.services || []).reduce((acc, s) => {
                    const cost = (s.total_cost !== undefined && s.total_cost !== null && !isNaN(parseFloat(s.total_cost)))
                        ? parseFloat(s.total_cost)
                        : (parseFloat(s.rate) || 0) * (parseFloat(s.multiply_by) || 1);
                    return acc + (isNaN(cost) ? 0 : cost);
                }, 0);
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
                    finishings: comp.finishings,
                    compName: comp.name
                };

                if (comp.type === 'offset') {
                    result = calculateOffset(compParams);
                } else if (comp.type === 'digital') {
                    result = calculateDigital(compParams);
                } else {
                    // Skip unknown types rather than erroring the whole calculation
                    result = {
                        costs: { paper: 0, plate: 0, printing: 0, finishing: 0, total: 0 },
                        printedSheets: 0, fullSheetsUsed: 0, wastageSheets: 0,
                        totalSheetsRequired: 0, plateCount: 0,
                        computedFinishings: []
                    };
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

            results.push({
                ...result,
                component_name: comp.name,
                component_id: comp.id
            });
            grandTotal += result.costs.total;
        }

        return NextResponse.json({
            results,
            costs: { total: grandTotal }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Calculation failed', details: error.message }, { status: 500 });
    }
}
