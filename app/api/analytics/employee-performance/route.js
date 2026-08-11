import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const employeeName = searchParams.get('employeeName');

        // Fetch distinct employees list from DB
        const [empRows] = await pool.execute(
            `SELECT DISTINCT name FROM (
                SELECT CONVERT(name USING utf8mb4) AS name FROM employees
                UNION
                SELECT CONVERT(employee_name USING utf8mb4) AS name FROM job_task_work_logs WHERE employee_name IS NOT NULL AND CHAR_LENGTH(employee_name) > 0
                UNION
                SELECT CONVERT(completed_by USING utf8mb4) AS name FROM job_tasks WHERE completed_by IS NOT NULL AND CHAR_LENGTH(completed_by) > 0
            ) AS combined_emp ORDER BY name ASC`
        );
        const availableEmployees = empRows.map(r => r.name).filter(Boolean);

        // Date filter SQL
        let logDateWhere = '';
        const logParams = [];

        if (startDate && endDate) {
            logDateWhere = ` AND (wl.started_at BETWEEN ? AND ?)`;
            logParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        // Fetch comprehensive employee metrics
        const [empMetrics] = await pool.execute(`
            SELECT
                emp_name AS name,
                COUNT(DISTINCT wl_id) AS log_count,
                SUM(duration_seconds) AS total_seconds,
                COUNT(DISTINCT completed_task_id) AS completed_tasks,
                SUM(DISTINCT CASE WHEN completed_task_id IS NOT NULL THEN estimated_minutes END) AS total_est_mins,
                SUM(DISTINCT CASE WHEN completed_task_id IS NOT NULL THEN target_output END) AS total_est_output,
                SUM(DISTINCT CASE WHEN completed_task_id IS NOT NULL THEN actual_output END) AS total_act_output,
                SUM(DISTINCT CASE WHEN completed_task_id IS NOT NULL THEN wasted_output END) AS total_wasted_output
            FROM (
                SELECT
                    wl.id AS wl_id,
                    COALESCE(
                        NULLIF(CONVERT(wl.employee_name USING utf8mb4), ''),
                        CONVERT(jt.completed_by USING utf8mb4)
                    ) AS emp_name,
                    COALESCE(wl.duration_seconds, 0) AS duration_seconds,
                    CASE WHEN jt.status = 'done' THEN jt.id ELSE NULL END AS completed_task_id,
                    COALESCE(jt.estimated_minutes, 0) AS estimated_minutes,
                    COALESCE(jt.sheet_count, jt.quantity, jt.impression_count, 0) AS target_output,
                    COALESCE(NULLIF(jt.actual_sheets_printed, 0), CASE WHEN jt.status = 'done' THEN COALESCE(jt.sheet_count, jt.quantity, 0) ELSE 0 END) AS actual_output,
                    COALESCE(jt.actual_sheets_wasted, 0) AS wasted_output
                FROM job_task_work_logs wl
                LEFT JOIN job_tasks jt ON wl.task_id = jt.id
                WHERE (wl.employee_name IS NOT NULL AND CHAR_LENGTH(wl.employee_name) > 0)
                   OR (jt.completed_by IS NOT NULL AND CHAR_LENGTH(jt.completed_by) > 0)
                ${logDateWhere}
            ) AS combined
            WHERE emp_name IS NOT NULL AND CHAR_LENGTH(emp_name) > 0
            GROUP BY emp_name
            ORDER BY total_seconds DESC
        `, logParams);

        // Format summary list
        const employeeSummaries = empMetrics.map(r => {
            const loggedSeconds = parseFloat(r.total_seconds) || 0;
            const actMinsRound = Math.round(loggedSeconds / 60);
            const estMins = parseFloat(r.total_est_mins) || 0;
            const completedTasks = parseFloat(r.completed_tasks) || 0;
            const logCount = parseFloat(r.log_count) || 0;
            const estOutput = parseFloat(r.total_est_output) || 0;
            const actOutput = parseFloat(r.total_act_output) || 0;
            const wastedOutput = parseFloat(r.total_wasted_output) || 0;
            const efficiencyPct = actMinsRound > 0 && estMins > 0 ? Math.round((estMins / actMinsRound) * 100) : null;
            const outputYieldPct = estOutput > 0 ? Math.round((actOutput / estOutput) * 100) : null;

            return {
                name: r.name,
                logCount,
                completedTasks,
                loggedSeconds,
                actMinsRound,
                estMins,
                estOutput,
                actOutput,
                wastedOutput,
                efficiencyPct,
                outputYieldPct
            };
        });

        // Overall aggregate metrics
        const totalActiveOperators = employeeSummaries.length;
        const totalLoggedSeconds = employeeSummaries.reduce((sum, e) => sum + e.loggedSeconds, 0);
        const totalCompletedTasks = employeeSummaries.reduce((sum, e) => sum + e.completedTasks, 0);
        const totalEstMins = employeeSummaries.reduce((sum, e) => sum + e.estMins, 0);
        const totalActMins = employeeSummaries.reduce((sum, e) => sum + e.actMinsRound, 0);
        const totalEstOutput = employeeSummaries.reduce((sum, e) => sum + e.estOutput, 0);
        const totalActOutput = employeeSummaries.reduce((sum, e) => sum + e.actOutput, 0);
        const totalWastedOutput = employeeSummaries.reduce((sum, e) => sum + e.wastedOutput, 0);
        const overallEfficiencyPct = totalActMins > 0 && totalEstMins > 0 ? Math.round((totalEstMins / totalActMins) * 100) : null;
        const overallOutputYieldPct = totalEstOutput > 0 ? Math.round((totalActOutput / totalEstOutput) * 100) : null;

        // Detail for selected employee modal
        let selectedEmployeeDetail = null;
        if (employeeName) {
            let logQuery = `
                SELECT
                    wl.id, wl.task_id, wl.employee_name, wl.started_at, wl.stopped_at, wl.duration_seconds, wl.created_at,
                    jt.name AS task_name, jt.quantity, jt.sheet_count, jt.estimated_minutes, jt.actual_sheets_printed, jt.actual_sheets_wasted, jt.status AS task_status,
                    so.code AS order_code, so.customer_name,
                    m.name AS machine_name
                FROM job_task_work_logs wl
                JOIN job_tasks jt ON wl.task_id = jt.id
                LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                LEFT JOIN machines m ON jt.machine_id = m.id
                WHERE (CONVERT(wl.employee_name USING utf8mb4) = ? OR CONVERT(jt.completed_by USING utf8mb4) = ?)
            `;
            const logDetailParams = [employeeName, employeeName];
            if (startDate && endDate) {
                logQuery += ` AND wl.started_at BETWEEN ? AND ?`;
                logDetailParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
            }
            logQuery += ` ORDER BY wl.started_at DESC LIMIT 50`;

            const [logs] = await pool.execute(logQuery, logDetailParams);

            selectedEmployeeDetail = {
                employeeName,
                summary: employeeSummaries.find(e => e.name === employeeName) || {
                    name: employeeName,
                    logCount: 0,
                    loggedSeconds: 0,
                    completedTasks: 0,
                    estMins: 0,
                    actMinsRound: 0,
                    estOutput: 0,
                    actOutput: 0,
                    wastedOutput: 0,
                    efficiencyPct: null,
                    outputYieldPct: null
                },
                logs: logs.map(l => ({
                    ...l,
                    duration_seconds: parseFloat(l.duration_seconds) || 0,
                    estimated_minutes: l.estimated_minutes != null ? parseFloat(l.estimated_minutes) : null,
                    quantity: parseFloat(l.quantity) || 0,
                    sheet_count: parseFloat(l.sheet_count) || 0,
                    actual_sheets_printed: parseFloat(l.actual_sheets_printed) || 0,
                    actual_sheets_wasted: parseFloat(l.actual_sheets_wasted) || 0
                }))
            };
        }

        return NextResponse.json({
            availableEmployees,
            stats: {
                totalActiveOperators,
                totalLoggedSeconds,
                totalCompletedTasks,
                totalEstMins,
                totalActMins,
                totalEstOutput,
                totalActOutput,
                totalWastedOutput,
                overallEfficiencyPct,
                overallOutputYieldPct
            },
            employees: employeeSummaries,
            selectedEmployeeDetail
        });
    } catch (err) {
        console.error('Employee performance API error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
