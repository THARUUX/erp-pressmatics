import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/job-planning/employee
 * Returns all active employees with their assigned job tasks.
 * job_tasks.assigned_to stores the employee NAME (string).
 */
export async function GET() {
    try {
        // Fetch all active employees
        const [employees] = await pool.execute(
            `SELECT id, employee_id, name, job_title, department, shift, status
             FROM employees
             WHERE status = 'active'
             ORDER BY name ASC`
        );

        if (!employees.length) {
            return NextResponse.json({ employees: [], orders: [], tasks: [] });
        }

        // Fetch tasks assigned to any of these employees by name
        const names = employees.map(e => e.name);
        const placeholders = names.map(() => '?').join(',');

        const [tasks] = await pool.execute(
            `SELECT jt.*,
                    so.code AS order_code,
                    so.customer_name,
                    so.delivery_date AS order_delivery_date,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.assigned_to IN (${placeholders})
             ORDER BY jt.scheduled_date ASC, jt.display_order ASC, jt.id ASC`,
            names
        );

        // Fetch relevant sales orders
        const orderIds = [...new Set(tasks.filter(t => t.sales_order_id).map(t => t.sales_order_id))];
        let orders = [];
        if (orderIds.length > 0) {
            const orderPlaceholders = orderIds.map(() => '?').join(',');
            const [rows] = await pool.execute(
                `SELECT so.id, so.code, so.customer_name, so.status, so.delivery_date, so.quotation_id,
                        (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                         FROM quotation_items qi
                         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                         WHERE qli.quotation_id = so.quotation_id) AS estimation_names
                 FROM sales_orders so
                 WHERE so.id IN (${orderPlaceholders})
                 ORDER BY so.delivery_date ASC`,
                orderIds
            );
            orders = rows;
        }

        // Enrich employees with their tasks (match by name)
        const employeesWithTasks = employees.map(emp => ({
            ...emp,
            tasks: tasks.filter(t => t.assigned_to === emp.name),
        }));

        return NextResponse.json({ employees: employeesWithTasks, orders, tasks });
    } catch (err) {
        console.error('[employee-planning GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
