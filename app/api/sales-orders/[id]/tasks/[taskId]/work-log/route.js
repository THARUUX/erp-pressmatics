import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET work logs for a task
export async function GET(req, { params }) {
    try {
        const { taskId } = await params;
        const [logs] = await pool.execute(
            `SELECT * FROM job_task_work_logs WHERE task_id = ? ORDER BY started_at ASC`,
            [taskId]
        );

        let totalSeconds = 0;
        const byEmployee = {};

        for (const log of logs) {
            let secs = log.duration_seconds || 0;
            if (!log.stopped_at && log.started_at) {
                const start = new Date(log.started_at).getTime();
                const now = Date.now();
                secs = Math.max(0, Math.floor((now - start) / 1000));
            }
            totalSeconds += secs;
            byEmployee[log.employee_name] = (byEmployee[log.employee_name] || 0) + secs;
        }

        return NextResponse.json({
            logs,
            totalSeconds,
            totalMinutes: Math.round(totalSeconds / 60),
            byEmployee,
        });
    } catch (error) {
        console.error('Work Log GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch work logs' }, { status: 500 });
    }
}

// POST work log action (start, stop, ready, update_estimate)
export async function POST(req, { params }) {
    try {
        const { taskId } = await params;
        const body = await req.json();
        const { action, employee_name, estimated_minutes } = body;

        // Verify task exists
        const [tasks] = await pool.execute('SELECT * FROM job_tasks WHERE id = ?', [taskId]);
        if (tasks.length === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        const task = tasks[0];
        const activeEmp = employee_name || task.assigned_to || 'Employee';

        if (action === 'start') {
            // Stop any currently running logs for this task first
            await pool.execute(
                `UPDATE job_task_work_logs 
                 SET stopped_at = NOW(), 
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
                 WHERE task_id = ? AND stopped_at IS NULL`,
                [taskId]
            );

            // Insert new work log session
            await pool.execute(
                `INSERT INTO job_task_work_logs (task_id, employee_name, started_at) 
                 VALUES (?, ?, NOW())`,
                [taskId, activeEmp]
            );

            // Update task status
            await pool.execute(
                `UPDATE job_tasks 
                 SET status = 'in_progress', assigned_to = ?, started_at = IFNULL(started_at, NOW())
                 WHERE id = ?`,
                [activeEmp, taskId]
            );

            return NextResponse.json({ success: true, message: `Timer started for ${activeEmp}` });
        }

        if (action === 'stop') {
            // Stop active work log
            await pool.execute(
                `UPDATE job_task_work_logs 
                 SET stopped_at = NOW(), 
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
                 WHERE task_id = ? AND stopped_at IS NULL`,
                [taskId]
            );

            // Update task status to paused
            await pool.execute(
                `UPDATE job_tasks SET status = 'paused' WHERE id = ?`,
                [taskId]
            );

            return NextResponse.json({ success: true, message: 'Timer stopped' });
        }

        if (action === 'ready' || action === 'push_ready') {
            // Stop any active timer
            await pool.execute(
                `UPDATE job_task_work_logs 
                 SET stopped_at = NOW(), 
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
                 WHERE task_id = ? AND stopped_at IS NULL`,
                [taskId]
            );

            // Mark task done / ready
            await pool.execute(
                `UPDATE job_tasks SET status = 'done', completed_at = NOW() WHERE id = ?`,
                [taskId]
            );

            return NextResponse.json({ success: true, message: 'Task marked as Ready / Completed' });
        }

        if (action === 'reopen') {
            const targetStatus = body.target_status || 'paused'; // 'paused', 'in_progress', or 'pending'

            // 1. Stop any unclosed timer
            await pool.execute(
                `UPDATE job_task_work_logs 
                 SET stopped_at = NOW(), 
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
                 WHERE task_id = ? AND stopped_at IS NULL`,
                [taskId]
            );

            // 2. If target is in_progress, start a new work session
            if (targetStatus === 'in_progress') {
                await pool.execute(
                    `INSERT INTO job_task_work_logs (task_id, employee_name, started_at) 
                     VALUES (?, ?, NOW())`,
                    [taskId, activeEmp]
                );
            }

            // 3. Update task status, clear completed_at and completed_by (preserving past work logs)
            await pool.execute(
                `UPDATE job_tasks 
                 SET status = ?, completed_at = NULL, completed_by = NULL, updated_at = NOW() 
                 WHERE id = ?`,
                [targetStatus, taskId]
            );

            return NextResponse.json({
                success: true,
                message: `Task re-opened with status '${targetStatus}'. Accumulated past duration preserved.`
            });
        }

        if (action === 'update_estimate') {
            const mins = parseInt(estimated_minutes) || 0;
            await pool.execute(
                `UPDATE job_tasks SET estimated_minutes = ? WHERE id = ?`,
                [mins, taskId]
            );

            return NextResponse.json({ success: true, estimated_minutes: mins });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Work Log POST Error:', error);
        return NextResponse.json({ error: 'Failed to update work log' }, { status: 500 });
    }
}
