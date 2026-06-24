import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/competitor-analysis — list all analyses
export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT ca.*,
                COUNT(ce.id) AS competitor_count,
                MIN(ce.quoted_price) AS min_competitor_price,
                MAX(ce.quoted_price) AS max_competitor_price
            FROM competitor_analyses ca
            LEFT JOIN competitor_entries ce ON ce.analysis_id = ca.id
            GROUP BY ca.id
            ORDER BY ca.created_at DESC
        `);
        return NextResponse.json(rows);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

// POST /api/competitor-analysis — create new analysis
export async function POST(req) {
    try {
        const { name, description, estimation_id, usd_rate, competitors = [] } = await req.json();
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        let snapshot = null;
        let our_total = null;
        let est_id = null;

        if (estimation_id) {
            // Fetch the estimation
            const [items] = await pool.execute('SELECT * FROM quotation_items WHERE id = ?', [estimation_id]);
            if (!items.length) return NextResponse.json({ error: 'Estimation not found' }, { status: 404 });
            const est = items[0];

            // Validate: must be within 30 days
            const daysDiff = (Date.now() - new Date(est.created_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff > 30) {
                return NextResponse.json({ error: 'Estimation is older than 30 days and cannot be linked.' }, { status: 400 });
            }

            // Fetch components (details)
            const [details] = await pool.execute(
                'SELECT * FROM quotation_item_details WHERE quotation_item_id = ? ORDER BY id ASC',
                [estimation_id]
            );

            // Fetch machines with their plate cost (joined from inventory)
            const [machines] = await pool.execute(`
                SELECT m.id, m.name, m.type, m.speed, m.speed_unit,
                       p.unit_cost AS plate_cost, p.name AS plate_name
                FROM machines m
                LEFT JOIN inventory_items p ON m.plate_id = p.id
            `);
            const machineMap = Object.fromEntries(machines.map(m => [m.id, m]));

            // Collect all unique paper_ids to batch-fetch current inventory prices
            const paperIds = [...new Set(details.map(d => d.paper_id).filter(Boolean))];
            const inventoryMap = {};
            if (paperIds.length > 0) {
                const placeholders = paperIds.map(() => '?').join(',');
                const [invRows] = await pool.execute(
                    `SELECT id, name, unit_cost, uom, category FROM inventory_items WHERE id IN (${placeholders})`,
                    paperIds
                );
                invRows.forEach(r => { inventoryMap[r.id] = r; });
            }

            // Fetch all finishings for this estimation (with machine name)
            const [finishings] = await pool.execute(`
                SELECT qif.*, m.name AS machine_name
                FROM quotation_item_finishings qif
                LEFT JOIN machines m ON qif.machine_id = m.id
                WHERE qif.quotation_item_id = ?
                ORDER BY qif.id ASC
            `, [estimation_id]);

            // Group finishings by detail_id (null = global)
            const finishingsByDetail = {};
            const globalFinishings = [];
            for (const f of finishings) {
                const key = f.quotation_item_detail_id;
                if (key) {
                    if (!finishingsByDetail[key]) finishingsByDetail[key] = [];
                    finishingsByDetail[key].push({
                        name: f.name,
                        quantity: f.quantity,
                        unit_cost: parseFloat(f.unit_cost) || 0,
                        total_cost: parseFloat(f.total_cost) || 0,
                        cost_unit: f.cost_unit || 'Unit',
                        machine_name: f.machine_name || null,
                        is_machine: !!f.is_machine,
                        forms: f.forms || null,
                    });
                } else {
                    globalFinishings.push({
                        name: f.name,
                        quantity: f.quantity,
                        unit_cost: parseFloat(f.unit_cost) || 0,
                        total_cost: parseFloat(f.total_cost) || 0,
                        cost_unit: f.cost_unit || 'Unit',
                        machine_name: f.machine_name || null,
                        is_machine: !!f.is_machine,
                        forms: f.forms || null,
                    });
                }
            }

            // Build snapshot — record both estimation-time prices AND current live prices
            snapshot = {
                linked_at: new Date().toISOString(),
                estimation_name: est.estimation_name || est.job_description || `Estimation #${estimation_id}`,
                quantity: est.quantity,
                components: details.map(d => {
                    const machine = machineMap[d.machine_id] || null;
                    const invItem = d.paper_id ? (inventoryMap[d.paper_id] || null) : null;
                    return {
                        name: d.component_name,
                        type: d.type,
                        // Machine info
                        machine_name: machine?.name || null,
                        machine_type: machine?.type || null,
                        // Rates as recorded at estimation time
                        paper_cost_per_sheet: parseFloat(d.paper_cost_per_sheet) || 0,
                        plate_cost_unit: parseFloat(d.plate_cost_unit) || 0,
                        impression_cost_unit: parseFloat(d.impression_cost_unit) || 0,
                        // Current live rates from DB (for comparison)
                        current_paper_unit_cost: invItem ? parseFloat(invItem.unit_cost) : null,
                        current_paper_uom: invItem?.uom || null,
                        current_machine_plate_cost: machine?.plate_cost != null ? parseFloat(machine.plate_cost) : null,
                        current_machine_impression_cost: null,
                        // Paper identity
                        paper_id: d.paper_id || null,
                        paper_name: d.paper_name || invItem?.name || null,
                        paper_width_cm: parseFloat(d.paper_width_cm) || null,
                        paper_height_cm: parseFloat(d.paper_height_cm) || null,
                        // Counts / volumes
                        plate_count: d.plate_count,
                        printed_sheets: d.printed_sheets,
                        total_sheets: d.total_sheets,
                        // Final costs from estimation
                        final_paper_cost: parseFloat(d.final_paper_cost) || 0,
                        final_plate_cost: parseFloat(d.final_plate_cost) || 0,
                        final_printing_cost: parseFloat(d.final_printing_cost) || 0,
                        final_finishing_cost: parseFloat(d.final_finishing_cost) || 0,
                        // Component-level finishings
                        finishings: finishingsByDetail[d.id] || [],
                    };
                }),
                global_finishings: globalFinishings,
                total_amount: parseFloat(est.total_amount) || 0
            };
            our_total = parseFloat(est.total_amount) || 0;
            est_id = estimation_id;
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.execute(
                'INSERT INTO competitor_analyses (name, description, estimation_id, estimation_snapshot, our_total, usd_rate) VALUES (?, ?, ?, ?, ?, ?)',
                [name, description || null, est_id, snapshot ? JSON.stringify(snapshot) : null, our_total, usd_rate ? parseFloat(usd_rate) : null]
            );
            const analysisId = result.insertId;

            for (const c of competitors) {
                if (!c.competitor_name || !c.quoted_price) continue;
                await conn.execute(
                    'INSERT INTO competitor_entries (analysis_id, competitor_name, quoted_price, notes, usd_rate) VALUES (?, ?, ?, ?, ?)',
                    [analysisId, c.competitor_name, parseFloat(c.quoted_price), c.notes || null, c.usd_rate ? parseFloat(c.usd_rate) : null]
                );
            }

            await conn.commit();
            return NextResponse.json({ success: true, id: analysisId });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: e.message || 'Failed to create' }, { status: 500 });
    }
}
