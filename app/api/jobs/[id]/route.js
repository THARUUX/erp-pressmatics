import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateJobTasks } from '@/lib/task-generator';

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

// Public endpoint — no auth required (accessed via QR scan)
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch sales order
        const [orders] = await pool.execute(
            'SELECT * FROM sales_orders WHERE id = ?', [id]
        );
        if (!orders.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const order = orders[0];

        // Fetch quotation items (components)
        let items = [];
        if (order.quotation_id) {
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
                    `SELECT qid.*, m.name as machine_name
                     FROM quotation_item_details qid
                     LEFT JOIN machines m ON qid.machine_id = m.id
                     WHERE qid.quotation_item_id = ?
                     ORDER BY qid.id ASC`,
                    [item.id]
                );
                const [finishings] = await pool.execute(
                    `SELECT qif.*, m.name as machine_name
                     FROM quotation_item_finishings qif
                     LEFT JOIN machines m ON qif.machine_id = m.id
                     WHERE qif.quotation_item_id = ?
                     ORDER BY qif.id ASC`,
                    [item.id]
                );
                items.push({ ...item, details, finishings });
            }
        }

        // Fetch tasks with machine type
        let [tasks] = await pool.execute(
            `SELECT jt.*, m.type AS machine_type, m.name AS machine_name
             FROM job_tasks jt
             LEFT JOIN machines m ON jt.machine_id = m.id
             WHERE jt.sales_order_id = ?
             ORDER BY jt.display_order ASC, jt.id ASC`,
            [id]
        );

        // Auto-heal / auto-generate tasks for main manufacturing orders if missing or only 1 dummy task
        if (!order.service_id) {
            const isSingleDummyTask = tasks.length === 1 && tasks[0].display_order === 999 && !tasks[0].machine_id && tasks[0].status === 'pending';
            if (tasks.length === 0 || isSingleDummyTask) {
                await generateJobTasks(id);
                const [refetched] = await pool.execute(
                    `SELECT jt.*, m.type AS machine_type, m.name AS machine_name
                     FROM job_tasks jt
                     LEFT JOIN machines m ON jt.machine_id = m.id
                     WHERE jt.sales_order_id = ?
                     ORDER BY jt.display_order ASC, jt.id ASC`,
                    [id]
                );
                tasks = refetched;
            }
        }

        // Enrich tasks with estimation data
        const enrichedTasks = await enrichTasks(tasks);

        // Fetch employees, teams, machines, and finishings for assigned options
        const [employees] = await pool.execute(`SELECT id, name, job_title, department FROM employees ORDER BY name ASC`);
        const [teams] = await pool.execute(`SELECT id, name FROM teams ORDER BY name ASC`);
        const [machines] = await pool.execute(`SELECT id, name, assigned_employee_id, assigned_team_id, assigned_employee_ids, assigned_team_ids, assigned_helper_ids FROM machines`);
        const [finishings] = await pool.execute(`SELECT f.id, f.name, f.machine_id, f.assigned_employee_id, f.assigned_team_id, f.assigned_employee_ids, f.assigned_team_ids, f.assigned_helper_ids, m.assigned_employee_ids as machine_emp_ids, m.assigned_team_ids as machine_team_ids, m.assigned_employee_id as machine_emp_id, m.assigned_team_id as machine_team_id, m.assigned_helper_ids as machine_helper_ids FROM finishings f LEFT JOIN machines m ON f.machine_id = m.id`);

        const empMap = new Map(employees.map(e => [e.id, e]));
        const teamMap = new Map(teams.map(t => [t.id, t]));

        const parseJsonArray = (val, singleVal) => {
            let ids = [];
            if (val) {
                try { ids = typeof val === 'string' ? JSON.parse(val) : val; } catch { ids = []; }
            }
            if (!Array.isArray(ids) || ids.length === 0) {
                if (singleVal) ids = [parseInt(singleVal)];
                else ids = [];
            }
            return ids.map(i => parseInt(i)).filter(Boolean);
        };

        for (const task of enrichedTasks) {
            let assignedEmps = [];
            let assignedTeams = [];
            let assignedHelpers = [];
            let sourceName = null;

            let m = machines.find(mach => mach.id === task.machine_id);
            let f = null;
            if (!m && task.name) {
                const taskNameLower = task.name.toLowerCase();
                f = finishings.find(fin => fin.name && taskNameLower.includes(fin.name.toLowerCase().trim()));
                if (f && f.machine_id) {
                    m = machines.find(mach => mach.id === f.machine_id);
                }
            }

            if (m) {
                sourceName = m.name;
                const empIds = parseJsonArray(m.assigned_employee_ids, m.assigned_employee_id);
                const teamIds = parseJsonArray(m.assigned_team_ids, m.assigned_team_id);
                const helperIds = parseJsonArray(m.assigned_helper_ids, null);
                assignedEmps = empIds.map(i => empMap.get(i)).filter(Boolean);
                assignedTeams = teamIds.map(i => teamMap.get(i)).filter(Boolean);
                assignedHelpers = helperIds.map(i => empMap.get(i)).filter(Boolean);
            }

            if (f && assignedEmps.length === 0 && assignedTeams.length === 0) {
                if (!sourceName) sourceName = f.name;
                const empIds = parseJsonArray(f.assigned_employee_ids || f.machine_emp_ids, f.assigned_employee_id || f.machine_emp_id);
                const teamIds = parseJsonArray(f.assigned_team_ids || f.machine_team_ids, f.assigned_team_id || f.machine_team_id);
                const helperIds = parseJsonArray(f.assigned_helper_ids || f.machine_helper_ids, null);
                assignedEmps = empIds.map(i => empMap.get(i)).filter(Boolean);
                assignedTeams = teamIds.map(i => teamMap.get(i)).filter(Boolean);
                assignedHelpers = helperIds.map(i => empMap.get(i)).filter(Boolean);
            }

            task.assigned_options = {
                assigned_employees: assignedEmps,
                assigned_teams: assignedTeams,
                assigned_helpers: assignedHelpers,
                source_name: sourceName
            };
        }

        return NextResponse.json({ order, items, tasks: enrichedTasks, employees, teams });
    } catch (err) {
        console.error('Job GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
