import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateJobTasks, resolveRunQty, getComponentTotalCutSheets } from '@/lib/task-generator';

// ─── Helper to resolve code or ID to numeric ID ─────────────────────────────
async function getSalesOrderId(idOrCode) {
    if (!idOrCode || idOrCode === 'unassigned' || idOrCode === 'null' || idOrCode === 'undefined' || idOrCode === '0') {
        return null;
    }
    if (!isNaN(idOrCode)) {
        return parseInt(idOrCode);
    }
    const [orders] = await pool.execute('SELECT id FROM sales_orders WHERE code = ?', [idOrCode]);
    return orders[0]?.id || null;
}

export async function GET(req, { params }) {
    try {
        const resolvedParams = await params;
        const rawId = resolvedParams?.id;
        if (!rawId || rawId === 'undefined' || rawId === 'null') {
            return NextResponse.json({ error: 'Invalid or missing Sales Order ID' }, { status: 400 });
        }

        const id = await getSalesOrderId(rawId);
        if (!id) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        let [tasks] = await pool.execute(
            `SELECT jt.*, m.type AS machine_type 
             FROM job_tasks jt
             LEFT JOIN machines m ON jt.machine_id = m.id
             WHERE jt.sales_order_id = ? 
             ORDER BY jt.display_order ASC, jt.id ASC`,
            [id]
        );

        // Auto-heal / auto-generate tasks for main manufacturing orders if missing or only 1 dummy task
        const [soRows] = await pool.execute('SELECT service_id FROM sales_orders WHERE id = ?', [id]);
        const so = soRows[0];
        if (so && !so.service_id) {
            const isSingleDummyTask = tasks.length === 1 && tasks[0].display_order === 999 && !tasks[0].machine_id && tasks[0].status === 'pending';
            if (tasks.length === 0 || isSingleDummyTask) {
                tasks = await generateJobTasks(id);
                const [refetched] = await pool.execute(
                    `SELECT jt.*, m.type AS machine_type 
                     FROM job_tasks jt
                     LEFT JOIN machines m ON jt.machine_id = m.id
                     WHERE jt.sales_order_id = ? 
                     ORDER BY jt.display_order ASC, jt.id ASC`,
                    [id]
                );
                tasks = refetched;
            }
        }

        const enrichedTasks = await enrichTasksWithEstimationDetailsForGet(tasks, [id]);
        return NextResponse.json(enrichedTasks);
    } catch (err) {
        console.error('Tasks GET error stack trace:', err.stack || err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function enrichTasksWithEstimationDetailsForGet(tasks, orderIds) {
    if (!tasks || !tasks.length || !orderIds || !orderIds.length) return tasks;

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

    let finishings = [];
    try {
        const [finRows] = await pool.execute(
            `SELECT qif.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                    m.speed_unit AS machine_speed_unit, m.type AS machine_type
             FROM quotation_item_finishings qif
             JOIN quotation_items qi ON qif.quotation_item_id = qi.id
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             JOIN sales_orders so ON so.quotation_id = qli.quotation_id
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE so.id IN (${placeholders})`,
            orderIds
        );
        finishings = finRows;
    } catch (e) {
        console.error('Error fetching finishings in enrichTasks:', e);
    }

    for (const task of tasks) {
        const taskName = task.name || '';
        const isOffset = taskName.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
        const isDigital = taskName.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';
        const isPrepress = (task.machine_type || '').toLowerCase() === 'prepress' || taskName.toLowerCase().includes('plate making') || taskName.toLowerCase().includes('pre-press');

        if (isOffset || isDigital || isPrepress) {
            const parts = taskName.split(' — ');
            const compName = (parts.length >= 3 ? parts[1] : '') || '';

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
                const typeMatch = (isOffset && d.type === 'offset') || (isDigital && d.type === 'digital') || (isPrepress && d.type === 'offset');
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
                task.setup_minutes_per_plate = detail.setup_minutes_per_plate || 0;
                task.net_sheet_count = Math.ceil(cutSheets);
                task.wastage_sheets = wastage;
                task.sides = sidesVal;
                if (isPrepress) {
                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        task.quantity = computedPlateCount;
                    }
                } else if (task.quantity == null || task.quantity === 0) {
                    const speedUnit = task.custom_speed_unit || detail.machine_speed_unit || 'Sheets/Hr';
                    const sidesVal = parseInt(detail.sides) || 1;
                    task.quantity = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: detail.item_qty || 0
                    });
                }
            }
        } else {
            // Match finishing
            let bestFinishing = null;
            let bestScore = -1;

            const parts = taskName.split(' — ');
            const finName = parts[0]?.trim().toLowerCase();
            const compName = parts.length >= 3 ? parts[1]?.trim().toLowerCase() : '';

            for (const f of finishings) {
                if (f.sales_order_id !== task.sales_order_id) continue;
                if (!f.name) continue;

                let score = 0;
                const fNameLower = f.name.toLowerCase().trim();

                if (finName && fNameLower === finName) {
                    score += 10;
                } else if (finName && (fNameLower.includes(finName) || finName.includes(fNameLower))) {
                    score += 5;
                }

                // If component name is in the task, match it with detail component name
                if (compName && f.quotation_item_detail_id) {
                    const d = details.find(det => det.id === f.quotation_item_detail_id);
                    if (d && d.component_name) {
                        const c2 = d.component_name.toLowerCase().trim();
                        if (compName === c2) {
                            score += 20;
                        } else if (compName.includes(c2) || c2.includes(compName)) {
                            score += 10;
                        }
                    }
                }

                if (task.machine_id && f.machine_id && task.machine_id === f.machine_id) {
                    score += 2;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestFinishing = f;
                }
            }

            const finishing = bestScore > 0 ? bestFinishing : null;
            if (finishing) {
                task.job_qty = finishing.item_qty || 0;

                const speedUnit = task.custom_speed_unit || finishing.machine_speed_unit || finishing.cost_unit || '';
                const su = speedUnit.toLowerCase().trim();
                const matchingDetail = details.find(d => d.id === finishing.quotation_item_detail_id);

                if (su.includes('unit')) {
                    task.job_qty = finishing.item_qty || 0;
                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        task.quantity = finishing.item_qty || 0;
                    }
                } else if (su.includes('form') || su === 'forms/hr') {
                    task.job_qty = finishing.item_qty || 0;
                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        const isBB = matchingDetail && parseInt(matchingDetail.is_bb) === 1;
                        if (isBB) {
                            task.quantity = finishing.item_qty || 0;
                        } else {
                            const formsCount = finishing.forms != null && finishing.forms > 0
                                ? parseFloat(finishing.forms)
                                : (matchingDetail
                                    ? ((parseInt(matchingDetail.ups) * parseInt(matchingDetail.sides)) > 0
                                        ? Math.ceil((parseInt(matchingDetail.pages) || 1) / ((parseInt(matchingDetail.ups) || 1) * (parseInt(matchingDetail.sides) || 1)))
                                        : 1)
                                    : 1);
                            task.quantity = formsCount * (finishing.item_qty || 0);
                        }
                    }
                } else if (matchingDetail) {
                    const isBB = parseInt(matchingDetail.is_bb) === 1;
                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        if (isBB && su.includes('form')) {
                            task.quantity = finishing.item_qty || 0;
                        } else {
                            const pagesVal = parseInt(matchingDetail.pages) || 1;
                            const upsVal = parseInt(matchingDetail.ups) || 1;
                            const sidesVal = parseInt(matchingDetail.sides) || 1;
                            const divisor = upsVal * sidesVal;
                            let netCutSheets = parseFloat(matchingDetail.printed_sheets) || 0;
                            if (divisor > 0 && finishing.item_qty > 0) {
                                netCutSheets = Math.ceil((pagesVal * finishing.item_qty) / divisor);
                            }
                            const totalCutSheets = netCutSheets + (parseFloat(matchingDetail.wastage_sheets) || 0);

                            if (su.includes('print')) {
                                task.quantity = totalCutSheets * sidesVal;
                            } else if (su.includes('sheet')) {
                                task.quantity = totalCutSheets;
                            }
                        }
                    }
                }
            }
        }
    }
    return tasks;
}

export async function POST(req, { params }) {
    try {
        const resolvedParams = await params;
        const rawId = resolvedParams?.id;
        if (!rawId || rawId === 'undefined' || rawId === 'null') {
            return NextResponse.json({ error: 'Invalid or missing Sales Order ID' }, { status: 400 });
        }

        const isUnassigned = rawId === 'unassigned' || rawId === '0' || rawId === 'none';
        const id = isUnassigned ? null : await getSalesOrderId(rawId);
        if (!isUnassigned && !id) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const body = await req.json();

        // Auto-generate from job components (machine-aware)
        if (body.generateDefaults || body.generateFromJob) {
            if (!id) return NextResponse.json({ error: 'Sales Order required for auto-generating tasks' }, { status: 400 });
            const tasks = await generateJobTasks(id);
            const enrichedTasks = await enrichTasksWithEstimationDetailsForGet(tasks, [id]);
            return NextResponse.json(enrichedTasks);
        }

        // Create single task
        const { name, description, assigned_to, scheduled_date, display_order, estimated_minutes, machine_id, machine_name, quantity } = body;
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        const [result] = await pool.execute(
            'INSERT INTO job_tasks (sales_order_id, name, description, machine_id, machine_name, assigned_to, scheduled_date, display_order, estimated_minutes, quantity, is_manual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [id, name, description || null, machine_id || null, machine_name || null, assigned_to || null, scheduled_date || null, display_order ?? 99, estimated_minutes || null, quantity || null]
        );
        const [task] = await pool.execute('SELECT * FROM job_tasks WHERE id = ?', [result.insertId]);
        return NextResponse.json(task[0]);
    } catch (err) {
        console.error('Tasks POST error stack trace:', err.stack || err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

