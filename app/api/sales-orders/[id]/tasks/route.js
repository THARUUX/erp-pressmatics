import { NextResponse } from 'next/server';
import pool from '@/lib/db';

function getComponentTotalCutSheets(detail, qty) {
    const pagesVal = parseInt(detail.pages) || 1;
    const upsVal = parseInt(detail.ups) || 1;
    const sidesVal = parseInt(detail.sides) || 1;
    const totalPages = pagesVal * qty;
    const divisor = upsVal * sidesVal;
    const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;
    const wastage = parseFloat(detail.wastage_sheets) || 0;
    return Math.ceil(cutSheets + wastage);
}

// ─── Generate tasks from actual job components (machine-aware) ───────────────
async function generateJobTasks(id) {
    // Get sales order
    const [orders] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [id]);
    if (!orders.length) return [];
    const order = orders[0];

    // Clear existing tasks to prevent duplication
    await pool.execute('DELETE FROM job_tasks WHERE sales_order_id = ?', [id]);

    // Get line items + details + finishings
    const [lineItems] = await pool.execute(
        `SELECT qi.*, qli.display_order
         FROM quotation_items qi
         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
         WHERE qli.quotation_id = ?
         ORDER BY qli.display_order ASC`,
        [order.quotation_id]
    );

    for (const item of lineItems) {
        const [details] = await pool.execute(
            `SELECT qid.*, m.name as machine_name, m.speed as machine_speed, m.speed_unit as machine_speed_unit, m.make_ready_minutes as machine_make_ready_minutes
             FROM quotation_item_details qid
             LEFT JOIN machines m ON qid.machine_id = m.id
             WHERE qid.quotation_item_id = ?
             ORDER BY qid.id ASC`,
            [item.id]
        );
        const [finishings] = await pool.execute(
            `SELECT qif.*, m.name as machine_name, m.speed, m.speed_unit
             FROM quotation_item_finishings qif
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE qif.quotation_item_id = ?`,
            [item.id]
        );
        const [services] = await pool.execute(
            `SELECT * FROM quotation_item_services WHERE quotation_item_id = ? ORDER BY id ASC`,
            [item.id]
        );
        item.details = details;
        item.finishings = finishings;
        item.services = services;
    }

    // ── Build task list ────────────────────────────────────────────────────
    // Fetch CTP (prepress) machine for plate making tasks
    const [ctpRows] = await pool.execute("SELECT id, name, speed FROM machines WHERE type = 'prepress' LIMIT 1");
    const ctpMachine = ctpRows[0] || null;

    const taskList = [];
    let order_idx = 0;

    taskList.push({
        name: 'Pre-press / File Check',
        description: 'Check artwork files, preflight & colour profile verification',
        machine_id: ctpMachine?.id || null,
        machine_name: ctpMachine?.name || null,
        display_order: order_idx++,
        estimated_minutes: 15
    });

    for (const item of lineItems) {
        const itemName = item.estimation_name || item.job_description || `Item ${item.id}`;

        // Generate services tasks
        const itemServices = item.services || [];
        for (const s of itemServices) {
            let estMins = null;
            if (s.rate_unit && (s.rate_unit.toLowerCase().includes('hour') || s.rate_unit.toLowerCase().includes('hr'))) {
                estMins = Math.round((parseFloat(s.multiply_by) || 0) * 60);
            }
            taskList.push({
                name: s.employee_name ? `Service: ${s.service_name} — ${s.employee_name}` : `Service: ${s.service_name}`,
                description: `Unit: ${s.rate_unit} · Rate: ${s.rate} · Mult: ${s.multiply_by} · Note: ${s.note || ''}`.trim(),
                assigned_to: s.employee_name || null,
                machine_id: null,
                machine_name: null,
                display_order: order_idx++,
                estimated_minutes: estMins
            });
        }

        for (const detail of item.details) {
            const compName = detail.component_name || itemName;
            const machine = detail.machine_name;
            const type = detail.type;

            if (type === 'offset' && compName !== 'Finishing' && machine) {
                const cf = parseInt(detail.colors_front ?? detail.colors ?? 4);
                const cb = parseInt(detail.colors_back ?? 0);
                const colorStr = cb > 0 ? `${cf}+${cb}` : `${cf}`;
                
                const plateCount = detail.plate_count || (cf + cb);
                const ctpSpeed = parseFloat(ctpMachine?.speed) || 60;
                const plateEstMins = Math.ceil((plateCount / ctpSpeed) * 60);

                taskList.push({
                    name: `Plate Making — ${compName} (${colorStr} colours)`,
                    description: `${plateCount} plates required`,
                    machine_id: ctpMachine?.id || null,
                    machine_name: ctpMachine?.name || null,
                    display_order: order_idx++,
                    estimated_minutes: plateEstMins,
                    quantity: plateCount,
                    sheet_count: 0,
                    impression_count: 0
                });

                const totalCutSheets = getComponentTotalCutSheets(detail, item.quantity);
                const totalImpressions = parseFloat(detail.printed_sheets) || 0;
                const offsetSpeed = parseFloat(detail.machine_speed) || 0;
                const speedUnit = detail.machine_speed_unit || 'Sheets/Hr';
                const makeReady = parseFloat(detail.machine_make_ready_minutes) || 0;

                const runQty = speedUnit.toLowerCase() === 'impressions/hr'
                    ? totalImpressions
                    : (speedUnit.toLowerCase() === 'sheets/hr' ? totalCutSheets : item.quantity);

                let offsetEstMins = null;
                if (offsetSpeed > 0) {
                    offsetEstMins = Math.ceil((runQty / offsetSpeed) * 60) + makeReady;
                }

                taskList.push({
                    name: `Offset Printing — ${machine} — ${compName}`,
                    description: `${detail.total_sheets || ''} sheets · ${detail.ups || 1} ups · ${detail.sides === 2 ? 'double sided' : 'single sided'}`.trim(),
                    machine_id: detail.machine_id || null,
                    machine_name: machine || null,
                    display_order: order_idx++,
                    estimated_minutes: offsetEstMins,
                    quantity: runQty,
                    sheet_count: totalCutSheets,
                    impression_count: totalImpressions
                });

            } else if (type === 'digital' && machine) {
                const totalCutSheets = getComponentTotalCutSheets(detail, item.quantity);
                const totalImpressions = parseFloat(detail.printed_sheets) || 0;
                const digitalSpeed = parseFloat(detail.machine_speed) || 0;
                const speedUnit = detail.machine_speed_unit || 'Sheets/Hr';
                const makeReady = parseFloat(detail.machine_make_ready_minutes) || 0;

                const runQty = speedUnit.toLowerCase() === 'impressions/hr'
                    ? totalImpressions
                    : (speedUnit.toLowerCase() === 'sheets/hr' ? totalCutSheets : item.quantity);

                let digitalEstMins = null;
                if (digitalSpeed > 0) {
                    digitalEstMins = Math.ceil((runQty / digitalSpeed) * 60) + makeReady;
                }

                taskList.push({
                    name: `Digital Print — ${machine} — ${compName}`,
                    description: `${detail.total_sheets || ''} sheets`.trim(),
                    machine_id: detail.machine_id || null,
                    machine_name: machine || null,
                    display_order: order_idx++,
                    estimated_minutes: digitalEstMins,
                    quantity: runQty,
                    sheet_count: totalCutSheets,
                    impression_count: totalImpressions
                });
            }
        }

        // Component-level finishings
        const componentFinishings = item.finishings?.filter(f => f.quotation_item_detail_id != null) || [];
        for (const f of componentFinishings) {
            const qty = parseFloat(f.quantity) || 0;
            const speed = parseFloat(f.speed) || 0;
            let estMins = null;
            if (qty && speed) {
                estMins = Math.ceil((qty / speed) * 60);
            } else {
                estMins = parseFloat(f.total_time) || null;
            }

            taskList.push({
                name: `${f.name} — ${itemName}`,
                description: f.machine_name ? `Machine: ${f.machine_name}` : null,
                machine_id: f.machine_id || null,
                machine_name: f.machine_name || null,
                display_order: order_idx++,
                estimated_minutes: estMins,
                quantity: qty
            });
        }

        // Global (order-level) finishings
        const globalFinishings = item.finishings?.filter(f => f.quotation_item_detail_id == null) || [];
        for (const f of globalFinishings) {
            // Avoid duplicate if already added
            const alreadyAdded = taskList.some(t => t.name.startsWith(f.name));
            if (!alreadyAdded) {
                const qty = parseFloat(f.quantity) || 0;
                const speed = parseFloat(f.speed) || 0;
                let estMins = null;
                if (qty && speed) {
                    estMins = Math.ceil((qty / speed) * 60);
                } else {
                    estMins = parseFloat(f.total_time) || null;
                }

                taskList.push({
                    name: f.name,
                    description: f.machine_name ? `Machine: ${f.machine_name}` : null,
                    machine_id: f.machine_id || null,
                    machine_name: f.machine_name || null,
                    display_order: order_idx++,
                    estimated_minutes: estMins,
                    quantity: qty
                });
            }
        }
    }

    taskList.push({ name: 'Quality Check', display_order: order_idx++ });
    taskList.push({ name: 'Packing', display_order: order_idx++ });
    taskList.push({ name: 'Delivery', display_order: order_idx++ });

    // Insert into DB
    for (const t of taskList) {
        await pool.execute(
            'INSERT INTO job_tasks (sales_order_id, name, description, machine_id, machine_name, assigned_to, display_order, estimated_minutes, quantity, sheet_count, impression_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [parseInt(id), t.name, t.description || null, t.machine_id || null, t.machine_name || null, t.assigned_to || null, t.display_order, t.estimated_minutes || null, t.quantity || null, t.sheet_count || null, t.impression_count || null]
        );
    }

    const [inserted] = await pool.execute(
        'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC',
        [id]
    );
    return inserted;
}

// ─── Helper to resolve code or ID to numeric ID ─────────────────────────────
async function getSalesOrderId(idOrCode) {
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

        const [tasks] = await pool.execute(
            'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC, id ASC',
            [id]
        );
        const enrichedTasks = await enrichTasksWithEstimationDetailsForGet(tasks, [id]);
        return NextResponse.json(enrichedTasks);
    } catch (err) {
        console.error('Tasks GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function enrichTasksWithEstimationDetailsForGet(tasks, orderIds) {
    if (!tasks || !tasks.length || !orderIds || !orderIds.length) return tasks;

    const placeholders = orderIds.map(() => '?').join(',');
    const [details] = await pool.execute(
        `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id
         FROM quotation_item_details qid
         JOIN quotation_items qi ON qid.quotation_item_id = qi.id
         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
         JOIN sales_orders so ON so.quotation_id = qli.quotation_id
         WHERE so.id IN (${placeholders})`,
        orderIds
    );

    for (const task of tasks) {
        const isOffset = task.name.toLowerCase().includes('offset printing');
        const isDigital = task.name.toLowerCase().includes('digital print');

        if (isOffset || isDigital) {
            const parts = task.name.split(' — ');
            const compName = parts[parts.length - 1]?.trim();

            const detail = details.find(d => 
                d.sales_order_id === task.sales_order_id && 
                (d.component_name === compName || 
                 (isOffset && d.type === 'offset') || 
                 (isDigital && d.type === 'digital'))
            );

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
                task.job_qty = detail.item_qty || 0;
                if (task.quantity == null || task.quantity === 0) {
                    const speedUnit = task.custom_speed_unit || detail.machine_speed_unit || 'Sheets/Hr';
                    task.quantity = speedUnit.toLowerCase() === 'impressions/hr'
                        ? totalImpressions
                        : (speedUnit.toLowerCase() === 'sheets/hr' ? totalCutSheets : detail.item_qty);
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

        const id = await getSalesOrderId(rawId);
        if (!id) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const body = await req.json();

        // Auto-generate from job components (machine-aware)
        if (body.generateDefaults || body.generateFromJob) {
            const tasks = await generateJobTasks(id);
            const enrichedTasks = await enrichTasksWithEstimationDetailsForGet(tasks, [id]);
            return NextResponse.json(enrichedTasks);
        }

        // Create single task
        const { name, description, assigned_to, display_order, estimated_minutes } = body;
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        const [result] = await pool.execute(
            'INSERT INTO job_tasks (sales_order_id, name, description, assigned_to, display_order, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?)',
            [id, name, description || null, assigned_to || null, display_order ?? 99, estimated_minutes || null]
        );
        const [task] = await pool.execute('SELECT * FROM job_tasks WHERE id = ?', [result.insertId]);
        return NextResponse.json(task[0]);
    } catch (err) {
        console.error('Tasks POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

