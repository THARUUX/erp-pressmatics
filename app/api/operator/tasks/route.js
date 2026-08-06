import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Resolve run quantity based on speed unit
function resolveRunQty(speedUnit, { totalCutSheets = 0, sidesVal = 1, totalImpressions = 0, itemQty = 0, isBB = false, ups = 1, pages = 1, sheets = 1 } = {}) {
    const u = (speedUnit || 'Sheets/Hr').toLowerCase().trim();
    const sides = parseInt(sidesVal) || 1;
    const upsVal = parseInt(ups) || 1;
    const pagesVal = parseInt(pages) || 1;
    const sheetsVal = parseFloat(sheets) || 1;
    const qty = parseFloat(itemQty) || 0;

    if (u === 'prints/hr') return totalCutSheets * sides;
    if (u === 'sheets/hr') {
        if (isBB) return totalCutSheets * ((upsVal * sides) / pagesVal);
        return totalCutSheets / sheetsVal;
    }
    if (u === 'impressions/hr') return totalImpressions || (totalCutSheets * sides);
    return qty;
}

// Enrich tasks with estimation details (plates, sheets, wastage)
async function enrichTasks(tasks) {
    if (!tasks || !tasks.length) return tasks;

    const orderIds = Array.from(new Set(tasks.map(t => t.sales_order_id).filter(Boolean)));
    if (!orderIds.length) return tasks;

    const placeholders = orderIds.map(() => '?').join(',');
    const [details] = await pool.execute(
        `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                m.setup_minutes_per_plate, m.make_ready_minutes, m.type AS machine_type
         FROM quotation_item_details qid
         JOIN quotation_items qi ON qid.quotation_item_id = qi.id
         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
         JOIN sales_orders so ON so.quotation_id = qli.quotation_id
         LEFT JOIN machines m ON qid.machine_id = m.id
         WHERE so.id IN (${placeholders})`,
        orderIds
    );

    for (const task of tasks) {
        const isOffset = task.name.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
        const isDigital = task.name.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';

        // Initialize default/empty values
        task.job_qty = 0;
        task.plate_count = 0;
        task.net_sheet_count = 0;
        task.wastage_sheets = 0;
        task.sides = 1;

        if (isOffset || isDigital) {
            const parts = task.name.split(' — ');
            const compName = parts.length >= 3 ? parts[1]?.trim() : '';

            let bestDetail = null;
            let bestScore = -1;

            for (const d of details) {
                if (d.sales_order_id !== task.sales_order_id) continue;

                let score = 0;

                // Check component name match
                if (compName && d.component_name) {
                    const c1 = compName.toLowerCase().trim();
                    const c2 = d.component_name.toLowerCase().trim();
                    if (c1 === c2) {
                        score += 20;
                    } else if (c1.includes(c2) || c2.includes(c1)) {
                        score += 10;
                    }
                }

                // Check machine_id match
                if (task.machine_id && d.machine_id && task.machine_id === d.machine_id) {
                    score += 5;
                }

                // Check type match
                const typeMatch = (isOffset && d.type === 'offset') || (isDigital && d.type === 'digital');
                if (typeMatch) {
                    score += 1;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestDetail = d;
                }
            }

            const detail = bestScore > 0 ? bestDetail : null;

            if (detail) {
                const pagesVal = parseInt(detail.pages) || 1;
                const upsVal = parseInt(detail.ups) || 1;
                const sidesVal = parseInt(detail.sides) || 1;
                const totalPages = pagesVal * (detail.item_qty || 0);
                const divisor = upsVal * sidesVal;
                const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;
                const wastage = parseFloat(detail.wastage_sheets) || 0;
                const totalCutSheets = Math.ceil(cutSheets + wastage);

                const totalImpressions = parseFloat(detail.printed_sheets) || 0;

                if (task.sheet_count == null || task.sheet_count === 0) {
                    task.sheet_count = totalCutSheets;
                }
                if (task.impression_count == null || task.impression_count === 0) {
                    task.impression_count = totalImpressions;
                }
                const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
                const colorsVal = parseInt(detail.colors || detail.colors_front || 4);
                const colorsFront = parseInt(detail.colors_front || detail.colors || 4);
                const isBB = parseInt(detail.is_bb) === 1;
                const computedPlateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);

                task.job_qty = detail.item_qty || 0;
                task.plate_count = computedPlateCount;
                task.net_sheet_count = Math.ceil(cutSheets);
                task.wastage_sheets = wastage;
                task.sides = sidesVal;
                
                if (task.quantity == null || task.quantity === 0) {
                    const speedUnit = task.custom_speed_unit || detail.machine_speed_unit || 'Sheets/Hr';
                    task.quantity = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: detail.item_qty || 0
                    });
                }
            }
        }
    }
    return tasks;
}

const matchesFinishing = (taskName, finName) => {
    if (!taskName || !finName) return false;
    const tNorm = taskName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    const fNorm = finName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    return tNorm.startsWith(fNorm) || tNorm.includes(fNorm) || fNorm.includes(tNorm);
};

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const machineId = searchParams.get('machineId');
        const finishingId = searchParams.get('finishingId');
        const dateParam = searchParams.get('date'); // YYYY-MM-DD
        const search = searchParams.get('search'); // For QR scans/searches (SO code, SO id, or task id)

        // Handle finishing-based task query
        if (finishingId) {
            const [finRows] = await pool.execute('SELECT id, name FROM finishings WHERE id = ?', [finishingId]);
            if (!finRows.length) {
                return NextResponse.json({ error: 'Finishing process not found' }, { status: 404 });
            }
            const finishing = finRows[0];

            let finQuery = `
                SELECT jt.*, 
                       so.code AS order_code, 
                       so.customer_name, 
                       so.status AS order_status, 
                       so.delivery_date
                FROM job_tasks jt
                LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                WHERE jt.machine_id IS NULL
                  AND (so.status IS NULL OR so.status NOT IN ('Delivered', 'Cancelled'))
            `;
            const finParams = [];

            if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
                finQuery += ` AND jt.scheduled_date = ?`;
                finParams.push(dateParam);
            }

            finQuery += ` ORDER BY jt.machine_position ASC, jt.scheduled_date ASC, jt.display_order ASC, jt.id ASC`;

            const [finTasks] = await pool.execute(finQuery, finParams);
            const filtered = finTasks.filter(t => matchesFinishing(t.name, finishing.name));

            return NextResponse.json({ tasks: filtered });
        }

        let query = `
            SELECT jt.*, 
                   so.code AS order_code, 
                   so.customer_name, 
                   so.status AS order_status, 
                   so.delivery_date,
                   m.type AS machine_type
            FROM job_tasks jt
            JOIN sales_orders so ON jt.sales_order_id = so.id
            LEFT JOIN machines m ON jt.machine_id = m.id
            WHERE so.status NOT IN ('Delivered', 'Cancelled')
        `;
        const params = [];

        if (search) {
            let cleanSearch = search.trim();
            const jobUrlMatch = cleanSearch.match(/\/jobs\/(\d+)/);
            if (jobUrlMatch) {
                query += ` AND so.id = ?`;
                params.push(parseInt(jobUrlMatch[1]));
            } else if (cleanSearch.toUpperCase().startsWith('SO-')) {
                query += ` AND so.code = ?`;
                params.push(cleanSearch);
            } else if (!isNaN(cleanSearch)) {
                query += ` AND (so.id = ? OR jt.id = ?)`;
                params.push(parseInt(cleanSearch), parseInt(cleanSearch));
            } else {
                query += ` AND (so.code LIKE ? OR so.customer_name LIKE ? OR jt.name LIKE ?)`;
                const term = `%${cleanSearch}%`;
                params.push(term, term, term);
            }
        } else if (machineId) {
            query += ` AND jt.machine_id = ?`;
            params.push(parseInt(machineId));

            // Add date filter if provided
            if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
                query += ` AND jt.scheduled_date = ?`;
                params.push(dateParam);
            }
        } else {
            return NextResponse.json({ error: 'Either machineId, finishingId, or search parameter is required' }, { status: 400 });
        }

        query += ` ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC, jt.id ASC`;

        const [tasks] = await pool.execute(query, params);
        const enriched = await enrichTasks(tasks);

        return NextResponse.json({ tasks: enriched });
    } catch (error) {
        console.error('Operator Tasks GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
