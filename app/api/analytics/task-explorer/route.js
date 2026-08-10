import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const matchesFinishing = (taskName, finName) => {
    if (!taskName || !finName) return false;
    const tNorm = taskName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    const fNorm = finName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    return tNorm.startsWith(fNorm) || tNorm.includes(fNorm) || fNorm.includes(tNorm);
};

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get('date');
        const type = searchParams.get('type'); // 'machine' or 'finishing'
        const resourceId = searchParams.get('resourceId');
        const taskId = searchParams.get('taskId');

        // If taskId is provided, fetch full details for this task plus its work logs
        if (taskId) {
            const [taskRows] = await pool.execute(
                `SELECT jt.*, so.code AS order_code, so.customer_name, m.name AS machine_name, m.type AS machine_type,
                        COALESCE(
                            (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                            CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0)) ELSE NULL END
                        ) AS actual_minutes
                 FROM job_tasks jt
                 LEFT JOIN machines m ON jt.machine_id = m.id
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

            return NextResponse.json({
                task: taskRows[0],
                logs
            });
        }

        // Otherwise, fetch tasks matching date, type, and resourceId
        if (!dateStr || !type || !resourceId) {
            return NextResponse.json({ error: 'Missing required parameters: date, type, resourceId' }, { status: 400 });
        }

        let tasks = [];

        if (type === 'machine') {
            const [tRows] = await pool.execute(
                `SELECT jt.*, so.code AS order_code, so.customer_name, m.name AS machine_name, m.type AS machine_type,
                        COALESCE(
                            (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                            CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0)) ELSE NULL END
                        ) AS actual_minutes
                 FROM job_tasks jt
                 LEFT JOIN machines m ON jt.machine_id = m.id
                 LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                 WHERE DATE(jt.scheduled_date) = ? AND jt.machine_id = ?
                 ORDER BY jt.machine_position ASC, jt.id ASC`,
                [dateStr, resourceId]
            );
            tasks = tRows;
        } else if (type === 'finishing') {
            const [fRows] = await pool.execute('SELECT name FROM finishings WHERE id = ?', [resourceId]);
            if (!fRows.length) {
                return NextResponse.json({ error: 'Finishing resource not found' }, { status: 404 });
            }
            const finName = fRows[0].name;

            const [tRows] = await pool.execute(
                `SELECT jt.*, so.code AS order_code, so.customer_name,
                        COALESCE(
                            (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                            CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0)) ELSE NULL END
                        ) AS actual_minutes
                 FROM job_tasks jt
                 LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                 WHERE DATE(jt.scheduled_date) = ? AND jt.machine_id IS NULL
                 ORDER BY jt.id ASC`,
                [dateStr]
            );

            tasks = tRows.filter(t => matchesFinishing(t.name, finName));
        } else {
            return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
        }

        return NextResponse.json({ tasks });
    } catch (err) {
        console.error('Task explorer GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
