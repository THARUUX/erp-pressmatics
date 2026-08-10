import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Service tasks are identified by: machine_id IS NULL AND
// (name starts with 'Service:' OR name NOT LIKE '% — Finishings —%' and NOT LIKE '% — Finishing —%')
// We filter by completed_at date OR created_at date for pending tasks

const SERVICE_TASK_CONDITION = `
    jt.machine_id IS NULL
    AND jt.name NOT LIKE '%— Finishings —%'
    AND jt.name NOT LIKE '%— Finishing —%'
    AND jt.name NOT LIKE '% — Finishings%'
    AND jt.name NOT LIKE '% — Finishing%'
`;

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get('date');
        const taskId = searchParams.get('taskId');
        const serviceName = searchParams.get('serviceName'); // optional filter by service name

        // If taskId provided — fetch single task detail + work logs
        if (taskId) {
            const [taskRows] = await pool.execute(
                `SELECT jt.*, so.code AS order_code, so.customer_name,
                        COALESCE(
                            (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                            CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL
                                 THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0))
                                 ELSE NULL END
                        ) AS actual_minutes
                 FROM job_tasks jt
                 LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                 WHERE jt.id = ?`,
                [taskId]
            );

            if (!taskRows.length) {
                return NextResponse.json({ error: 'Task not found' }, { status: 404 });
            }

            const [logs] = await pool.execute(
                `SELECT * FROM job_task_work_logs WHERE task_id = ? ORDER BY started_at ASC`,
                [taskId]
            );

            return NextResponse.json({ task: taskRows[0], logs });
        }

        // Fetch distinct service task name types for the dropdown
        if (searchParams.get('listTypes') === '1') {
            const [types] = await pool.execute(`
                SELECT DISTINCT
                    CASE
                        WHEN name LIKE 'Service: %' THEN SUBSTRING(name, 10)
                        ELSE name
                    END AS display_name,
                    CASE
                        WHEN name LIKE 'Service: %' THEN name
                        ELSE name
                    END AS filter_name
                FROM job_tasks
                WHERE ${SERVICE_TASK_CONDITION.trim()}
                ORDER BY display_name ASC
            `);
            return NextResponse.json({ types });
        }

        // Fetch tasks for a given date, filtered by serviceName
        if (!dateStr) {
            return NextResponse.json({ error: 'Missing required parameter: date' }, { status: 400 });
        }

        // Build query - service tasks have no scheduled_date so we filter by:
        // started_at date OR completed_at date OR created_at date
        let query = `
            SELECT jt.*, so.code AS order_code, so.customer_name,
                   COALESCE(
                       (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                       CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL
                            THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0))
                            ELSE NULL END
                   ) AS actual_minutes
            FROM job_tasks jt
            LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
            WHERE ${SERVICE_TASK_CONDITION.trim()}
            AND (
                DATE(jt.started_at) = ?
                OR DATE(jt.completed_at) = ?
                OR (jt.started_at IS NULL AND jt.completed_at IS NULL AND DATE(jt.created_at) = ?)
            )
        `;

        const params = [dateStr, dateStr, dateStr];

        if (serviceName) {
            query += ` AND (jt.name = ? OR jt.name LIKE ?)`;
            params.push(serviceName, `${serviceName} — %`);
        }

        query += ` ORDER BY jt.created_at DESC`;

        const [tasks] = await pool.execute(query, params);

        return NextResponse.json({ tasks });
    } catch (err) {
        console.error('Service explorer GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
