import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { syncSalesOrderToDeliveryQueue } from '@/lib/delivery-helper';

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

function toMySQL(isoStr) {
    if (!isoStr) return null;
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().slice(0, 19).replace('T', ' ');
    } catch {
        return null;
    }
}

async function syncSalesOrderStatus(salesOrderId) {
    if (!salesOrderId) return;
    try {
        const [orders] = await pool.execute('SELECT status FROM sales_orders WHERE id = ?', [salesOrderId]);
        if (orders.length === 0) return;
        const currentSoStatus = orders[0].status;
        if (currentSoStatus === 'Delivered' || currentSoStatus === 'Cancelled') return;

        const [tasks] = await pool.execute('SELECT status FROM job_tasks WHERE sales_order_id = ?', [salesOrderId]);
        if (tasks.length === 0) return;

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const inProgressOrPausedTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'paused').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;

        let newSoStatus = currentSoStatus;
        if (completedTasks === totalTasks) {
            newSoStatus = 'Ready';
        } else if (inProgressOrPausedTasks > 0 || (completedTasks > 0 && pendingTasks > 0)) {
            newSoStatus = 'In Production';
        } else if (pendingTasks === totalTasks) {
            newSoStatus = 'Pending';
        }

        if (newSoStatus !== currentSoStatus) {
            await pool.execute('UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE id = ?', [newSoStatus, salesOrderId]);
            if (newSoStatus === 'Ready' || newSoStatus === 'In Production') {
                try {
                    await syncSalesOrderToDeliveryQueue(salesOrderId, pool);
                } catch (e) {
                    console.error('Failed to sync to delivery queue in background:', e);
                }
            }
        }
    } catch (err) {
        console.error('Failed to sync Sales Order status:', err);
    }
}

export async function PATCH(req) {
    try {
        const body = await req.json();
        const { taskId, ...fields } = body;

        if (!taskId) {
            return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
        }

        const [current] = await pool.execute(
            'SELECT status, started_at, sales_order_id, assigned_to, helper_name FROM job_tasks WHERE id = ?',
            [taskId]
        );
        if (!current || current.length === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const prevStatus = current[0].status;
        const alreadyStarted = current[0].started_at;
        const salesOrderId = current[0].sales_order_id;

        const allowedFields = [
            'status', 'actual_sheets_printed', 'actual_sheets_wasted',
            'estimated_minutes', 'quantity', 'sheet_count', 'impression_count',
            'assigned_to', 'helper_name', 'completed_by', 'completed_by_helper',
            'downtime_minutes', 'downtime_reason', 'actual_plates_used',
            'description', 'notes', 'started_at', 'completed_at',
            'custom_speed', 'custom_speed_unit'
        ];

        const updates = [];
        const paramsList = [];

        for (const [key, value] of Object.entries(fields)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                if (key === 'started_at' || key === 'completed_at') {
                    paramsList.push(value ? toMySQL(value) : null);
                } else if (['actual_sheets_printed', 'actual_sheets_wasted', 'quantity', 'sheet_count', 'impression_count', 'custom_speed'].includes(key)) {
                    paramsList.push(value !== '' && value !== null && value !== undefined ? parseFloat(value) : null);
                } else if (['estimated_minutes', 'downtime_minutes', 'actual_plates_used'].includes(key)) {
                    paramsList.push(value !== '' && value !== null && value !== undefined ? parseInt(value) : null);
                } else {
                    paramsList.push(value !== undefined && value !== '' ? value : null);
                }
            }
        }

        // Automatic timestamp handling for status transition
        if (fields.status) {
            if ((fields.status === 'in_progress' || fields.status === 'paused') && prevStatus === 'pending' && !alreadyStarted && !fields.started_at) {
                updates.push('started_at = NOW()');
            }
            if (fields.status === 'done' && prevStatus !== 'done' && !fields.completed_at) {
                updates.push('completed_at = NOW()');
            }
        }

        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            paramsList.push(taskId);
            await pool.execute(
                `UPDATE job_tasks SET ${updates.join(', ')} WHERE id = ?`,
                paramsList
            );
        }

        // Manage work logs if status changed
        if (fields.status && fields.status !== prevStatus) {
            const empName = fields.assigned_to || current[0].assigned_to || 'Operator';
            if (fields.status === 'in_progress') {
                await pool.execute(
                    `UPDATE job_task_work_logs SET stopped_at = NOW(), duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW()) WHERE task_id = ? AND stopped_at IS NULL`,
                    [taskId]
                );
                await pool.execute(
                    `INSERT INTO job_task_work_logs (task_id, employee_name, started_at) VALUES (?, ?, NOW())`,
                    [taskId, empName]
                );
            } else if (fields.status === 'paused' || fields.status === 'done') {
                const stopTime = fields.completed_at ? new Date(fields.completed_at) : new Date();
                const [activeLogs] = await pool.execute(
                    `SELECT id, started_at FROM job_task_work_logs WHERE task_id = ? AND stopped_at IS NULL`,
                    [taskId]
                );
                for (const log of activeLogs) {
                    const startMs = new Date(log.started_at).getTime();
                    const durationSecs = Math.max(0, Math.floor((stopTime.getTime() - startMs) / 1000));
                    await pool.execute(
                        `UPDATE job_task_work_logs SET stopped_at = ?, duration_seconds = ? WHERE id = ?`,
                        [toMySQL(stopTime.toISOString()), durationSecs, log.id]
                    );
                }
                if (fields.status === 'done' && prevStatus === 'pending' && activeLogs.length === 0) {
                    const logStart = fields.started_at ? toMySQL(fields.started_at) : (alreadyStarted ? toMySQL(alreadyStarted) : toMySQL(new Date().toISOString()));
                    const logStop = fields.completed_at ? toMySQL(fields.completed_at) : toMySQL(new Date().toISOString());
                    const startMs = new Date(logStart).getTime();
                    const stopMs = new Date(logStop).getTime();
                    const durationSecs = Math.max(0, Math.floor((stopMs - startMs) / 1000));
                    await pool.execute(
                        `INSERT INTO job_task_work_logs (task_id, employee_name, started_at, stopped_at, duration_seconds) VALUES (?, ?, ?, ?, ?)`,
                        [taskId, empName, logStart, logStop, durationSecs]
                    );
                }
            }
        }

        // Sync sales order status
        if (salesOrderId) {
            await syncSalesOrderStatus(salesOrderId);
        }

        // Fetch refreshed task and work logs
        const [updatedTask] = await pool.execute(
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

        const [logs] = await pool.execute(
            `SELECT * FROM job_task_work_logs WHERE task_id = ? ORDER BY started_at ASC`,
            [taskId]
        );

        return NextResponse.json({
            task: updatedTask[0],
            logs
        });
    } catch (err) {
        console.error('Task explorer PATCH error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
