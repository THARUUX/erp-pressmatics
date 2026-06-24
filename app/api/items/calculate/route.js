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
            const isSFGComp = (comp.name || '').includes('Assets') || (comp.name || '').includes('SFG');
            let result;

            if (isSFGComp) {
                // SFG/Asset components: sum their sfgLines as cost, no print calculation
                const sfgLinesCost = (comp.sfgLines || []).reduce((acc, sl) =>
                    acc + (parseFloat(sl.quantity) || 0) * (parseFloat(sl.unit_price) || 0), 0);
                result = {
                    costs: { paper: 0, plate: 0, printing: 0, finishing: 0, total: sfgLinesCost },
                    printedSheets: 0, fullSheetsUsed: 0, wastageSheets: 0,
                    totalSheetsRequired: 0, plateCount: 0,
                    computedFinishings: []
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
