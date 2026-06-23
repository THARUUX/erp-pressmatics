import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Machine info
        const [machines] = await pool.execute('SELECT * FROM machines WHERE id = ?', [id]);
        if (!machines.length) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
        const machine = machines[0];

        // Overall task summary
        const [summary] = await pool.execute(`
            SELECT
                COUNT(*)                                                            AS total_tasks,
                COUNT(CASE WHEN status = 'done' THEN 1 END)                        AS completed,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END)                 AS in_progress,
                COUNT(CASE WHEN status = 'pending' THEN 1 END)                     AS pending,
                ROUND(AVG(CASE WHEN status = 'done' AND started_at IS NOT NULL AND completed_at IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, started_at, completed_at) END), 1)  AS avg_active_mins,
                ROUND(AVG(CASE WHEN status = 'done' AND completed_at IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, created_at, completed_at) END), 1)  AS avg_total_mins,
                ROUND(SUM(CASE WHEN status = 'done' AND started_at IS NOT NULL AND completed_at IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, started_at, completed_at) END), 0)  AS total_active_mins,
                MIN(CASE WHEN status = 'done' AND completed_at IS NOT NULL THEN completed_at END) AS first_completed,
                MAX(CASE WHEN status = 'done' AND completed_at IS NOT NULL THEN completed_at END) AS last_completed
            FROM job_tasks
            WHERE machine_id = ?
        `, [id]);

        // Monthly completed task counts (last 6 months)
        const [monthly] = await pool.execute(`
            SELECT
                DATE_FORMAT(completed_at, '%Y-%m') AS month,
                COUNT(*)                           AS tasks_done,
                ROUND(AVG(CASE WHEN started_at IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, started_at, completed_at) END), 1) AS avg_mins
            FROM job_tasks
            WHERE machine_id = ?
              AND status = 'done'
              AND completed_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY month
            ORDER BY month ASC
        `, [id]);

        // Recent completed tasks (last 20)
        const [recent] = await pool.execute(`
            SELECT
                jt.id, jt.name, jt.status, jt.created_at, jt.started_at, jt.completed_at, jt.completed_by,
                so.code AS order_code, so.customer_name,
                CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at)
                    ELSE NULL END AS active_mins,
                CASE WHEN jt.completed_at IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, jt.created_at, jt.completed_at)
                    ELSE NULL END AS total_mins
            FROM job_tasks jt
            JOIN sales_orders so ON jt.sales_order_id = so.id
            WHERE jt.machine_id = ? AND jt.status = 'done'
            ORDER BY jt.completed_at DESC
            LIMIT 20
        `, [id]);

        // Currently running task
        const [running] = await pool.execute(`
            SELECT jt.*, so.code AS order_code, so.customer_name
            FROM job_tasks jt
            JOIN sales_orders so ON jt.sales_order_id = so.id
            WHERE jt.machine_id = ? AND jt.status = 'in_progress'
            ORDER BY jt.started_at DESC LIMIT 1
        `, [id]);

        return NextResponse.json({
            machine,
            summary: summary[0],
            monthly,
            recent,
            currentTask: running[0] || null,
        });
    } catch (err) {
        console.error('Machine performance error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
