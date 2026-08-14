import { NextResponse } from 'next/server';
import { pool1, pool2 } from '@/lib/db';

async function ensureWorkLogTables() {
    const tableSql = `
        CREATE TABLE IF NOT EXISTS job_task_work_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            employee_name VARCHAR(255) NOT NULL,
            started_at DATETIME NOT NULL,
            stopped_at DATETIME NULL,
            duration_seconds INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_task (task_id),
            INDEX idx_employee (employee_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await Promise.all([
        pool1.execute(tableSql).catch(() => { }),
        pool2.execute(tableSql).catch(() => { })
    ]);
}

async function attachWorkLogs(tasks, pool) {
    if (!tasks || tasks.length === 0) return tasks;
    const ids = tasks.map(t => t.id);
    const placeholders = ids.map(() => '?').join(',');

    let logs = [];
    try {
        const [rows] = await pool.execute(
            `SELECT task_id, started_at, stopped_at, duration_seconds 
             FROM job_task_work_logs 
             WHERE task_id IN (${placeholders})`,
            ids
        );
        logs = rows;
    } catch (err) {
        console.error('attachWorkLogs error:', err);
    }

    const logMap = new Map();
    logs.forEach(l => {
        if (!logMap.has(l.task_id)) {
            logMap.set(l.task_id, { closed_seconds: 0, active_started_at: null });
        }
        const entry = logMap.get(l.task_id);
        if (l.stopped_at) {
            entry.closed_seconds += (parseInt(l.duration_seconds) || 0);
        } else {
            entry.active_started_at = l.started_at;
        }
    });

    return tasks.map(t => {
        const logData = logMap.get(t.id) || { closed_seconds: 0, active_started_at: null };
        return {
            ...t,
            closed_seconds: logData.closed_seconds,
            active_started_at: logData.active_started_at || (t.status === 'in_progress' ? t.started_at : null)
        };
    });
}

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        await ensureWorkLogTables();

        // Fetch machine details from pool1 first, fallback to pool2 if needed
        let [machines1] = await pool1.execute('SELECT * FROM machines WHERE id = ?', [id]);
        let machine = machines1[0];

        if (!machine) {
            const [machines2] = await pool2.execute('SELECT * FROM machines WHERE id = ?', [id]);
            machine = machines2[0];
        }

        if (!machine) {
            return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
        }

        const taskQuery = `
            SELECT jt.*,
                   so.code AS order_code,
                   so.customer_name,
                   so.status AS order_status,
                   so.delivery_date,
                   so.total_amount,
                   CASE
                     WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qi.type = 'services') > 0 THEN 'services'
                     WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qi.type = 'digital') > 0 THEN 'digital'
                     WHEN (SELECT COUNT(*) FROM quotation_item_details qid JOIN quotation_items qi ON qid.quotation_item_id = qi.id JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qid.type = 'digital') > 0 THEN 'digital'
                     WHEN jt.service_id IS NOT NULL THEN 'services'
                     ELSE 'offset'
                   END AS job_type
            FROM job_tasks jt
            JOIN sales_orders so ON jt.sales_order_id = so.id
            WHERE (jt.machine_id = ? OR LOWER(jt.machine_name) = LOWER(?))
              AND so.status NOT IN ('Delivered', 'Cancelled', 'Ready')
            ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC
        `;

        const [
            [tasks1],
            [tasks2],
            [employees1],
            [employees2]
        ] = await Promise.all([
            pool1.execute(taskQuery, [machine.id, machine.name]),
            pool2.execute(taskQuery, [machine.id, machine.name]),
            pool1.execute('SELECT id, name FROM employees WHERE status = "active"'),
            pool2.execute('SELECT id, name FROM employees WHERE status = "active"')
        ]);

        const [tasks1WithLogs, tasks2WithLogs] = await Promise.all([
            attachWorkLogs(tasks1, pool1),
            attachWorkLogs(tasks2, pool2)
        ]);

        const taggedTasks1 = tasks1WithLogs.map(t => ({ ...t, company_id: 1, company_name: 'Company 1' }));
        const taggedTasks2 = tasks2WithLogs.map(t => ({ ...t, company_id: 2, company_name: 'Company 2' }));

        const empMap = new Map();
        employees1.forEach(e => empMap.set(e.name, { name: e.name, company_id: 1 }));
        employees2.forEach(e => empMap.set(e.name, { name: e.name, company_id: 2 }));

        return NextResponse.json({
            machine,
            tasks: [...taggedTasks1, ...taggedTasks2],
            employees: Array.from(empMap.values())
        });
    } catch (err) {
        console.error('GET /api/common-portal/machines/[id] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const body = await req.json();
        const {
            taskId, companyId, action, employee_name,
            actual_sheets_printed, actual_sheets_wasted,
            downtime_minutes, downtime_reason,
            completed_by, completed_by_helper, completed_at, fields
        } = body;

        if (!taskId || !companyId) {
            return NextResponse.json({ error: 'taskId and companyId are required' }, { status: 400 });
        }

        const targetPool = parseInt(companyId) === 2 ? pool2 : pool1;
        await ensureWorkLogTables();

        if (action === 'start') {
            const empName = employee_name || 'Operator';
            // Stop any open logs for this task first
            await targetPool.execute(
                `UPDATE job_task_work_logs 
                 SET stopped_at = NOW(), 
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW()) 
                 WHERE task_id = ? AND stopped_at IS NULL`,
                [taskId]
            );
            // Insert new work log session
            await targetPool.execute(
                `INSERT INTO job_task_work_logs (task_id, employee_name, started_at) 
                 VALUES (?, ?, NOW())`,
                [taskId, empName]
            );
            // Update task status
            await targetPool.execute(
                `UPDATE job_tasks 
                 SET status = 'in_progress', 
                     started_at = IFNULL(started_at, NOW()), 
                     assigned_to = COALESCE(?, assigned_to) 
                 WHERE id = ?`,
                [empName, taskId]
            );
            return NextResponse.json({ success: true, message: `Task started for ${empName}` });
        }

        if (action === 'pause') {
            // Stop open logs for this task
            await targetPool.execute(
                `UPDATE job_task_work_logs 
                 SET stopped_at = NOW(), 
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW()) 
                 WHERE task_id = ? AND stopped_at IS NULL`,
                [taskId]
            );
            // Update status
            await targetPool.execute(
                `UPDATE job_tasks SET status = 'pending' WHERE id = ?`,
                [taskId]
            );
            return NextResponse.json({ success: true, message: 'Task paused and time logged' });
        }

        if (action === 'complete') {
            // Stop open logs for this task
            await targetPool.execute(
                `UPDATE job_task_work_logs 
                 SET stopped_at = NOW(), 
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW()) 
                 WHERE task_id = ? AND stopped_at IS NULL`,
                [taskId]
            );
            // Update status, actual output, downtime, and completion metadata
            await targetPool.execute(
                `UPDATE job_tasks 
                 SET status = 'done', 
                     actual_sheets_printed = ?,
                     actual_sheets_wasted = ?,
                     downtime_minutes = ?,
                     downtime_reason = ?,
                     completed_by = ?, 
                     completed_by_helper = ?, 
                     completed_at = ? 
                 WHERE id = ?`,
                [
                    actual_sheets_printed !== undefined && actual_sheets_printed !== null && actual_sheets_printed !== '' ? parseFloat(actual_sheets_printed) : null,
                    actual_sheets_wasted !== undefined && actual_sheets_wasted !== null && actual_sheets_wasted !== '' ? parseFloat(actual_sheets_wasted) : 0,
                    downtime_minutes !== undefined && downtime_minutes !== null && downtime_minutes !== '' ? parseInt(downtime_minutes) : 0,
                    downtime_reason || null,
                    completed_by || null,
                    completed_by_helper || null,
                    completed_at ? new Date(completed_at) : new Date(),
                    taskId
                ]
            );
            return NextResponse.json({ success: true, message: 'Task marked as done' });
        }

        if (fields && Object.keys(fields).length > 0) {
            const setClauses = [];
            const queryParams = [];
            Object.keys(fields).forEach(key => {
                setClauses.push(`${key} = ?`);
                queryParams.push(fields[key]);
            });
            queryParams.push(taskId);
            await targetPool.execute(
                `UPDATE job_tasks SET ${setClauses.join(', ')} WHERE id = ?`,
                queryParams
            );
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'No action or fields provided' }, { status: 400 });
    } catch (err) {
        console.error('PUT /api/common-portal/machines/[id] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
