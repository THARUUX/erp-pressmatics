import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/machines/[id]/tasks
// Returns machine details + all tasks assigned to it, grouped by sales order
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch machine
        const [machines] = await pool.execute('SELECT * FROM machines WHERE id = ?', [id]);
        if (!machines.length) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
        
        // Fetch all employees and teams to build employee map and resolve helpers/operators
        const [employees] = await pool.execute('SELECT id, name, status, job_title FROM employees');
        const [teams] = await pool.execute('SELECT t.id, t.name FROM teams t');
        const [teamMembers] = await pool.execute('SELECT team_id, employee_id FROM team_members');

        const empMap = new Map(employees.map(e => [e.id, e.name]));
        const teamMap = new Map(teams.map(t => [t.id, t.name]));

        const resolveAssignedEmployees = (empIds, teamIds) => {
            const list = [];
            const added = new Set();
            empIds.forEach(eid => {
                const name = empMap.get(parseInt(eid));
                if (name && !added.has(name)) {
                    list.push({ id: eid, name });
                    added.add(name);
                }
            });
            teamIds.forEach(tid => {
                const members = teamMembers.filter(tm => parseInt(tm.team_id) === parseInt(tid));
                members.forEach(tm => {
                    const name = empMap.get(parseInt(tm.employee_id));
                    if (name && !added.has(name)) {
                        list.push({ id: tm.employee_id, name });
                        added.add(name);
                    }
                });
            });
            return list;
        };

        const m = machines[0];
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

        const machine = {
            ...m,
            assigned_employees_list: assignedEmpsList,
            assigned_helpers_list: assignedHelpersList,
            assigned_employee_name: empNames || null,
            assigned_team_name: teamNames || null,
            assigned_helper_name: helperNames || null
        };

        // Fetch all tasks for this machine, joined with sales order info
        const [tasks] = await pool.execute(
            `SELECT jt.*,
                    so.code        AS order_code,
                    so.customer_name,
                    so.status      AS order_status,
                    so.delivery_date,
                    so.total_amount,
                    CASE
                      WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qi.type = 'services') > 0 THEN 'services'
                      WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qi.type = 'digital') > 0 THEN 'digital'
                      WHEN (SELECT COUNT(*) FROM quotation_item_details qid JOIN quotation_items qi ON qid.quotation_item_id = qi.id JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qid.type = 'digital') > 0 THEN 'digital'
                      WHEN jt.service_id IS NOT NULL THEN 'services'
                      ELSE 'offset'
                    END AS job_type,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names,
                    (SELECT SUM(qi2.quantity)
                     FROM quotation_items qi2
                     JOIN quotation_line_items qli2 ON qi2.id = qli2.quotation_item_id
                     WHERE qli2.quotation_id = so.quotation_id) AS total_units,
                     (SELECT SUM(qid.printed_sheets + qid.wastage_sheets)
                      FROM quotation_item_details qid
                      JOIN quotation_items qi3 ON qid.quotation_item_id = qi3.id
                      JOIN quotation_line_items qli3 ON qi3.id = qli3.quotation_item_id
                      WHERE qli3.quotation_id = so.quotation_id
                        AND qid.machine_id = jt.machine_id) AS total_cut_sheets,
                     (SELECT SUM(qid_i.printed_sheets)
                      FROM quotation_item_details qid_i
                      JOIN quotation_items qi3i ON qid_i.quotation_item_id = qi3i.id
                      JOIN quotation_line_items qli3i ON qi3i.id = qli3i.quotation_item_id
                      WHERE qli3i.quotation_id = so.quotation_id
                        AND qid_i.machine_id = jt.machine_id) AS total_impressions,
                    (SELECT SUM(qid2.plate_count)
                     FROM quotation_item_details qid2
                     JOIN quotation_items qi4 ON qid2.quotation_item_id = qi4.id
                     JOIN quotation_line_items qli4 ON qi4.id = qli4.quotation_item_id
                     WHERE qli4.quotation_id = so.quotation_id
                       AND qid2.machine_id = jt.machine_id) AS total_forms,
                    (SELECT SUM(qif.quantity)
                     FROM quotation_item_finishings qif
                     JOIN quotation_items qi5 ON qif.quotation_item_id = qi5.id
                     JOIN quotation_line_items qli5 ON qi5.id = qli5.quotation_item_id
                     WHERE qli5.quotation_id = so.quotation_id
                       AND qif.machine_id = jt.machine_id) AS total_finishing_qty,
                     (SELECT SUM((qid_p.printed_sheets + qid_p.wastage_sheets) * COALESCE(qid_p.sides, 1))
                      FROM quotation_item_details qid_p
                      JOIN quotation_items qi_p ON qid_p.quotation_item_id = qi_p.id
                      JOIN quotation_line_items qli_p ON qi_p.id = qli_p.quotation_item_id
                      WHERE qli_p.quotation_id = so.quotation_id
                        AND qid_p.machine_id = jt.machine_id) AS total_press_passes
             FROM job_tasks jt
             JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.machine_id = ?
               AND so.status NOT IN ('Delivered','Cancelled','Ready')
             ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC, jt.id ASC`,
            [id]
        );

        // Group tasks by sales order
        const ordersMap = {};
        for (const t of tasks) {
            const key = t.sales_order_id;
            if (!ordersMap[key]) {
                ordersMap[key] = {
                    id: key,
                    code: t.order_code,
                    customer_name: t.customer_name,
                    estimation_names: t.estimation_names || null,
                    status: t.order_status,
                    delivery_date: t.delivery_date,
                    total_amount: t.total_amount,
                    total_units: t.total_units,
                    total_cut_sheets: t.total_cut_sheets,
                    total_impressions: t.total_impressions,
                    total_forms: t.total_forms,
                    total_finishing_qty: t.total_finishing_qty,
                    total_press_passes: t.total_press_passes,
                    tasks: [],
                };
            }
            ordersMap[key].tasks.push({
                id: t.id,
                name: t.name,
                description: t.description,
                status: t.status,
                completed_at: t.completed_at,
                completed_by: t.completed_by,
                completed_by_helper: t.completed_by_helper,
                helper_name: t.helper_name,
                display_order: t.display_order,
                machine_position: t.machine_position,
                sales_order_id: t.sales_order_id,
            });
        }

        const orders = Object.values(ordersMap);

        return NextResponse.json({ machine, orders });
    } catch (err) {
        console.error('Machine tasks GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
