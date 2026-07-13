import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Resolve run quantity based on speed unit (mirrors tasks/route.js logic)
function resolveRunQty(speedUnit, { totalCutSheets, sidesVal, totalImpressions, itemQty }) {
    const u = (speedUnit || 'Sheets/Hr').toLowerCase().trim();
    if (u === 'prints/hr') return totalCutSheets * sidesVal;
    if (u === 'impressions/hr') return totalImpressions;
    if (u === 'sheets/hr') return totalCutSheets;
    return itemQty;
}

// GET /api/job-planning
// Returns { machines, orders }
// orders includes tasks with machine_id + machine_name
export async function GET() {
    try {
        // Fetch all machines with full details for task modal defaults
        const [machines] = await pool.execute(
            `SELECT id, name, type, speed, speed_unit, make_ready_minutes, shift_limit, sheet_factor,
                    (SELECT e.name FROM employees e WHERE e.id = machines.assigned_employee_id LIMIT 1) AS assigned_employee_name,
                    (SELECT t.name FROM teams t WHERE t.id = machines.assigned_team_id LIMIT 1) AS assigned_team_name
             FROM machines ORDER BY name ASC`
        );

        // Fetch all active sales orders, plus completed ones that have assigned machine tasks
        const [orders] = await pool.execute(
            `SELECT so.id, so.code, so.customer_name, so.status, so.delivery_date, so.quotation_id,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM sales_orders so
             WHERE so.status NOT IN ('Delivered','Cancelled','Ready')
                OR so.id IN (SELECT DISTINCT sales_order_id FROM job_tasks WHERE machine_id IS NOT NULL)
             ORDER BY so.delivery_date ASC, so.id DESC`
        );

        const orderIds = orders.map(o => o.id);
        let tasks = [];
        if (orderIds.length > 0) {
            const placeholders = orderIds.map(() => '?').join(',');
            const [rows] = await pool.execute(
                `SELECT jt.*, m.name AS machine_label, so.delivery_date AS order_delivery_date
                 FROM job_tasks jt
                 LEFT JOIN machines m ON jt.machine_id = m.id
                 JOIN sales_orders so ON jt.sales_order_id = so.id
                 WHERE jt.sales_order_id IN (${placeholders})
                 ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC, jt.id ASC`,
                orderIds
            );
            tasks = await enrichTasksWithEstimationDetails(rows, orderIds);
        }

        // Attach tasks to each order
        const ordersWithTasks = orders.map(o => ({
            ...o,
            tasks: tasks.filter(t => t.sales_order_id === o.id),
        }));

        return NextResponse.json({ machines, orders: ordersWithTasks });
    } catch (err) {
        console.error('Job planning GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function enrichTasksWithEstimationDetails(tasks, orderIds) {
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
