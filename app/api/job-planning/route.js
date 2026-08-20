import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import SalesOrderRepository from '@/lib/repositories/SalesOrderRepository';
import ResourceRepository from '@/lib/repositories/ResourceRepository';

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
        const cookieStore = await cookies();
        const c = cookieStore.get('activeCompanyId');
        let activeCompanyId = 1;
        if (c && c.value) activeCompanyId = parseInt(c.value, 10);
        // Fetch employees, teams, team_members, machines, finishings, and sales orders concurrently in parallel (cached resources)
        const [
            employees,
            teams,
            teamMembersResult,
            machinesRaw,
            finishingsRaw,
            orders
        ] = await Promise.all([
            ResourceRepository.getEmployees(pool),
            ResourceRepository.getTeams(pool),
            pool.execute(`SELECT team_id, employee_id FROM team_members`).catch(() => [[]]),
            ResourceRepository.getMachines(pool),
            ResourceRepository.getFinishings(pool),
            SalesOrderRepository.getPlanningSalesOrders(pool)
        ]);

        const teamMembers = teamMembersResult[0] || [];
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
                members.forEach(eId => empSet.add(eId));
            });
            return Array.from(empSet)
                .map(id => ({ id, name: empMap.get(id) }))
                .filter(e => Boolean(e.name));
        };

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
                 WHERE jt.sales_order_id IN (${placeholders})
                    OR (jt.sales_order_id IS NULL AND (jt.company_id = ? OR (jt.company_id IS NULL AND ? = 1)))
                 ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC, jt.id ASC`,
                [...orderIds, activeCompanyId, activeCompanyId]
            );
            tasks = await enrichTasksWithEstimationDetails(rows, orderIds);
        } else {
            const [rows] = await pool.execute(
                `SELECT jt.*, m.name AS machine_label, m.type AS machine_type, NULL AS order_delivery_date
                 FROM job_tasks jt
                 LEFT JOIN machines m ON jt.machine_id = m.id
                 WHERE jt.sales_order_id IS NULL AND (jt.company_id = ? OR (jt.company_id IS NULL AND ? = 1))
                 ORDER BY jt.machine_position ASC, jt.display_order ASC, jt.id ASC`,
                [activeCompanyId, activeCompanyId]
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
    const [
        [details],
        finishingsResult
    ] = await Promise.all([
        pool.execute(
            `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                    m.setup_minutes_per_plate, m.make_ready_minutes
             FROM quotation_item_details qid
             JOIN quotation_items qi ON qid.quotation_item_id = qi.id
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             JOIN sales_orders so ON so.quotation_id = qli.quotation_id
             LEFT JOIN machines m ON qid.machine_id = m.id
             WHERE so.id IN (${placeholders})`,
            orderIds
        ),
        pool.execute(
            `SELECT qif.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                    m.speed_unit AS machine_speed_unit, m.type AS machine_type
             FROM quotation_item_finishings qif
             JOIN quotation_items qi ON qif.quotation_item_id = qi.id
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             JOIN sales_orders so ON so.quotation_id = qli.quotation_id
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE so.id IN (${placeholders})`,
            orderIds
        ).catch(e => {
            console.error('Error fetching finishings in enrichTasks:', e);
            return [[]];
        })
    ]);
    const finishings = finishingsResult[0] || [];

    for (const task of tasks) {
        const isOffset = task.name.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
        const isDigital = task.name.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';
        const isPrepress = (task.machine_type || '').toLowerCase() === 'prepress' || task.name.toLowerCase().includes('plate making') || task.name.toLowerCase().includes('pre-press');

        if (isOffset || isDigital || isPrepress) {
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
                    task.is_finishing = false;
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
                if (!isPrepress) {
                    task.rate = parseFloat(detail.impression_cost_unit) || 0;
                    task.rate_unit = 'per 1000 impressions';
                    task.revenue = parseFloat(detail.final_printing_cost) || 0;
                    task.is_finishing = false;
                }
            }
        } else {
            // Match finishing
            let bestFinishing = null;
            let bestScore = -1;

            const parts = task.name.split(' — ');
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
                task.rate = parseFloat(finishing.unit_cost) || 0;
                task.rate_unit = finishing.cost_unit || 'Unit';
                task.revenue = parseFloat(finishing.total_cost) || 0;
                task.is_finishing = true;
            }
        }
    }
    return tasks;
}
