import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Resolve run quantity based on speed unit (mirrors tasks/route.js logic)
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

// GET /api/job-planning
// Returns { machines, orders }
// orders includes tasks with machine_id + machine_name
export async function GET() {
    try {
        const [employees] = await pool.execute(`SELECT id, name FROM employees`);
        const [teams] = await pool.execute(`SELECT id, name FROM teams`);
        let teamMembers = [];
        try {
            const [tmRows] = await pool.execute(`SELECT team_id, employee_id FROM team_members`);
            teamMembers = tmRows;
        } catch (e) {
            teamMembers = [];
        }

        const empMap = new Map(employees.map(e => [e.id, e.name]));
        const teamMap = new Map(teams.map(t => [t.id, t.name]));

        const teamMembersMap = new Map();
        for (const tm of teamMembers) {
            const tId = parseInt(tm.team_id);
            const eId = parseInt(tm.employee_id);
            if (!teamMembersMap.has(tId)) teamMembersMap.set(tId, []);
            teamMembersMap.get(tId).push(eId);
        }

        const resolveAssignedEmployees = (empIds, teamIds) => {
            const empSet = new Set();
            empIds.forEach(id => { if (id) empSet.add(parseInt(id)); });
            teamIds.forEach(tId => {
                const members = teamMembersMap.get(parseInt(tId)) || [];
                members.forEach(eId => empSet.add(parseInt(eId)));
            });
            return Array.from(empSet)
                .map(id => ({ id, name: empMap.get(id) }))
                .filter(e => Boolean(e.name));
        };

        const [machinesRaw] = await pool.execute(`SELECT * FROM machines ORDER BY name ASC`);
        const machines = machinesRaw.map(m => {
            let empIds = []; try { empIds = typeof m.assigned_employee_ids === 'string' ? JSON.parse(m.assigned_employee_ids) : (m.assigned_employee_ids || []); } catch {}
            if (!Array.isArray(empIds) || !empIds.length) { if (m.assigned_employee_id) empIds = [parseInt(m.assigned_employee_id)]; else empIds = []; }

            let teamIds = []; try { teamIds = typeof m.assigned_team_ids === 'string' ? JSON.parse(m.assigned_team_ids) : (m.assigned_team_ids || []); } catch {}
            if (!Array.isArray(teamIds) || !teamIds.length) { if (m.assigned_team_id) teamIds = [parseInt(m.assigned_team_id)]; else teamIds = []; }

            let helperIds = []; try { helperIds = typeof m.assigned_helper_ids === 'string' ? JSON.parse(m.assigned_helper_ids) : (m.assigned_helper_ids || []); } catch {}
            if (!Array.isArray(helperIds)) helperIds = [];

            const empNames = empIds.map(id => empMap.get(parseInt(id))).filter(Boolean).join(', ');
            const teamNames = teamIds.map(id => teamMap.get(parseInt(id))).filter(Boolean).join(', ');
            const helperNames = helperIds.map(id => empMap.get(parseInt(id))).filter(Boolean).join(', ');

            const assignedEmpsList = resolveAssignedEmployees(empIds, teamIds);
            const assignedHelpersList = helperIds.map(id => ({ id, name: empMap.get(parseInt(id)) })).filter(e => Boolean(e.name));

            return {
                ...m,
                assigned_employees_list: assignedEmpsList,
                assigned_helpers_list: assignedHelpersList,
                assigned_employee_name: empNames || null,
                assigned_team_name: teamNames || null,
                assigned_helper_name: helperNames || null
            };
        });

        // Fetch all active sales orders, plus completed ones that have assigned machine tasks
        const [orders] = await pool.execute(
            `SELECT so.id, so.code, so.customer_name, so.status, so.delivery_date, so.quotation_id, so.kanban_position,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM sales_orders so
             WHERE so.status NOT IN ('Delivered','Cancelled','Ready')
                OR so.id IN (SELECT DISTINCT sales_order_id FROM job_tasks WHERE machine_id IS NOT NULL)
             ORDER BY COALESCE(so.kanban_position, 999999) ASC, so.delivery_date ASC, so.id DESC`
        );

        // Fetch all finishings that do NOT have a machine assigned
        const [finishingsRaw] = await pool.execute(
            `SELECT * FROM finishings WHERE machine_id IS NULL OR is_machine = 0 ORDER BY name ASC`
        );
        const finishings = finishingsRaw.map(f => {
            let empIds = []; try { empIds = typeof f.assigned_employee_ids === 'string' ? JSON.parse(f.assigned_employee_ids) : (f.assigned_employee_ids || []); } catch {}
            if (!Array.isArray(empIds) || !empIds.length) { if (f.assigned_employee_id) empIds = [parseInt(f.assigned_employee_id)]; else empIds = []; }

            let teamIds = []; try { teamIds = typeof f.assigned_team_ids === 'string' ? JSON.parse(f.assigned_team_ids) : (f.assigned_team_ids || []); } catch {}
            if (!Array.isArray(teamIds) || !teamIds.length) { if (f.assigned_team_id) teamIds = [parseInt(f.assigned_team_id)]; else teamIds = []; }

            let helperIds = []; try { helperIds = typeof f.assigned_helper_ids === 'string' ? JSON.parse(f.assigned_helper_ids) : (f.assigned_helper_ids || []); } catch {}
            if (!Array.isArray(helperIds)) helperIds = [];

            const empNames = empIds.map(id => empMap.get(parseInt(id))).filter(Boolean).join(', ');
            const teamNames = teamIds.map(id => teamMap.get(parseInt(id))).filter(Boolean).join(', ');
            const helperNames = helperIds.map(id => empMap.get(parseInt(id))).filter(Boolean).join(', ');

            const assignedEmpsList = resolveAssignedEmployees(empIds, teamIds);
            const assignedHelpersList = helperIds.map(id => ({ id, name: empMap.get(parseInt(id)) })).filter(e => Boolean(e.name));

            return {
                ...f,
                assigned_employees_list: assignedEmpsList,
                assigned_helpers_list: assignedHelpersList,
                assigned_employee_name: empNames || null,
                assigned_team_name: teamNames || null,
                assigned_helper_name: helperNames || null
            };
        });

        const orderIds = orders.map(o => o.id);
        let tasks = [];
        if (orderIds.length > 0) {
            const placeholders = orderIds.map(() => '?').join(',');
            const [rows] = await pool.execute(
                `SELECT jt.*, m.name AS machine_label, m.type AS machine_type, so.delivery_date AS order_delivery_date
                 FROM job_tasks jt
                 LEFT JOIN machines m ON jt.machine_id = m.id
                 LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                 WHERE jt.sales_order_id IN (${placeholders}) OR jt.sales_order_id IS NULL
                 ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC, jt.id ASC`,
                orderIds
            );
            tasks = await enrichTasksWithEstimationDetails(rows, orderIds);
        } else {
            const [rows] = await pool.execute(
                `SELECT jt.*, m.name AS machine_label, m.type AS machine_type, NULL AS order_delivery_date
                 FROM job_tasks jt
                 LEFT JOIN machines m ON jt.machine_id = m.id
                 WHERE jt.sales_order_id IS NULL
                 ORDER BY jt.machine_position ASC, jt.display_order ASC, jt.id ASC`
            );
            tasks = await enrichTasksWithEstimationDetails(rows, []);
        }

        const standaloneTasks = tasks.filter(t => t.sales_order_id === null);

        // Attach tasks to each order
        const ordersWithTasks = orders.map(o => ({
            ...o,
            tasks: tasks.filter(t => t.sales_order_id === o.id),
        }));

        if (standaloneTasks.length > 0) {
            ordersWithTasks.push({
                id: null,
                code: 'GENERAL',
                customer_name: 'Standalone Tasks',
                status: 'In Progress',
                delivery_date: null,
                quotation_id: null,
                estimation_names: 'Manual / Standalone',
                tasks: standaloneTasks,
            });
        }

        return NextResponse.json({ machines, orders: ordersWithTasks, finishings, employees });
    } catch (err) {
        console.error('Job planning GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function enrichTasksWithEstimationDetails(tasks, orderIds) {
    if (!tasks || !tasks.length || !orderIds || !orderIds.length) return tasks;

    const placeholders = orderIds.map(() => '?').join(',');
    const [details] = await pool.execute(
        `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                m.setup_minutes_per_plate, m.make_ready_minutes
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
                task.setup_minutes_per_plate = detail.setup_minutes_per_plate || 0;
                task.net_sheet_count = Math.ceil(cutSheets);
                task.wastage_sheets = wastage;
                task.sides = sidesVal;
                if (task.quantity == null || task.quantity === 0) {
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
        }
    }
    return tasks;
}
