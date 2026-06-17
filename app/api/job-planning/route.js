import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/job-planning
// Returns { machines, orders }
// orders includes tasks with machine_id + machine_name
export async function GET() {
    try {
        // Fetch all machines
        const [machines] = await pool.execute(
            'SELECT id, name, type FROM machines ORDER BY name ASC'
        );

        // Fetch all active sales orders (exclude Delivered/Cancelled)
        const [orders] = await pool.execute(
            `SELECT so.id, so.code, so.customer_name, so.status, so.delivery_date, so.quotation_id,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM sales_orders so
             WHERE so.status NOT IN ('Delivered','Cancelled')
             ORDER BY so.delivery_date ASC, so.id DESC`
        );

        // Fetch tasks for all orders in one query
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
            tasks = rows;
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
