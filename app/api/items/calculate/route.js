import { NextResponse } from 'next/server';
import { calculateOffset, calculateDigital } from '@/lib/calculations';

export async function POST(req) {
    try {
        const body = await req.json();
        // Support both legacy (single) and new (multi-component) structures?
        // Let's enforce new structure or wrap legacy.

        let components = body.components;
        if (!components && body.params) {
            // Legacy fallback wrapper
            components = [{
                name: 'Main',
                type: body.type,
                quantity: body.quantity,
                params: body.params, // Should include finishings inside params if legacy? Or separate? 
                // Legacy body had: type, params, finishings (separate from params usually in UI but passed together?)
                // Legacy save route: finishings separate. calculate route: params usually held finishings?
                // Let's look at previous calculate route: { type, params } where params usually had everything including finishings? 
                // Actually previous calculate route: `const { type, params } = body;` -> `calculateOffset(params)`
                finishings: body.finishings || []
            }];
        }

        const results = [];
        let grandTotal = 0;

        for (const comp of components) {
            let result;
            const compParams = {
                ...comp.params,
                quantity: comp.quantity,
                finishings: comp.finishings
            };

            if (comp.type === 'offset') {
                result = calculateOffset(compParams);
            } else if (comp.type === 'digital') {
                result = calculateDigital(compParams);
            } else {
                return NextResponse.json({ error: `Invalid type for component ${comp.name}` }, { status: 400 });
            }

            // Add component name to result for identification
            results.push({
                ...result,
                component_name: comp.name,
                component_id: comp.id // tracking frontend ID
            });
            grandTotal += result.costs.total;
        }

        return NextResponse.json({
            results,
            costs: { total: grandTotal } // specific format to match expected structure? 
            // Old response was direct result object. Now we have array.
            // Frontend generic update will need to handle this.
            // Old UI expects: { costs: { total ... }, ... }
            // If we send `results` array, UI must sum it up or we send sum.
        });
    } catch (error) {
        return NextResponse.json({ error: 'Calculation failed', details: error.message }, { status: 500 });
    }
}
