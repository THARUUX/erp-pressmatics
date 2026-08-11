import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        let dateStr = searchParams.get('date');

        if (!dateStr) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        }

        // Fetch all machines
        const [machines] = await pool.execute(
            'SELECT id, name, type FROM machines ORDER BY name ASC'
        );

        // Fetch tasks scheduled for this date
        const [tasks] = await pool.execute(
            `SELECT jt.*, m.name AS machine_label, m.id AS machine_id, so.code AS order_code, so.customer_name,
                    COALESCE(
                        (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                        CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0)) ELSE NULL END
                    ) AS actual_minutes
             FROM job_tasks jt
             JOIN machines m ON jt.machine_id = m.id
             JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE DATE(jt.scheduled_date) = ?
             ORDER BY m.name ASC, jt.machine_position ASC, jt.id ASC`,
            [dateStr]
        );

        // Group tasks by machine and filter for machines with tasks only
        const reportData = machines.map(m => ({
            ...m,
            tasks: tasks.filter(t => t.machine_id === m.id)
        })).filter(m => m.tasks.length > 0);

        // Compute summary statistics
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (parseFloat(t.estimated_minutes) || 0), 0);
        const totalActualMinutes = tasks.reduce((sum, t) => sum + (parseFloat(t.actual_minutes) || 0), 0);

        return NextResponse.json({
            date: dateStr,
            stats: {
                totalTasks,
                completedTasks,
                totalEstimatedMinutes,
                totalActualMinutes
            },
            machines: reportData.map(m => ({
                ...m,
                tasks: m.tasks.map(t => ({
                    ...t,
                    estimated_minutes: t.estimated_minutes != null ? parseFloat(t.estimated_minutes) : null,
                    actual_minutes: t.actual_minutes != null ? parseFloat(t.actual_minutes) : null,
                }))
            }))
        });
    } catch (err) {
        console.error('Production reports GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
