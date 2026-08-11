import { renderToBuffer } from '@react-pdf/renderer';
import pool from '@/lib/db';
import EmployeeDailyReportPdfDocument from './EmployeeDailyReportPdfDocument';

function getPeriodKey(dateInput, periodType) {
    if (!dateInput) return 'Unknown';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Unknown';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    if (periodType === 'day') {
        return `${y}-${m}-${d}`;
    }
    if (periodType === 'week') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.getTime());
        monday.setDate(diff);
        const monY = monday.getFullYear();
        const monM = String(monday.getMonth() + 1).padStart(2, '0');
        const monD = String(monday.getDate()).padStart(2, '0');
        return `Wk ${monM}/${monD}`;
    }
    if (periodType === 'month') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${y}`;
    }
    if (periodType === 'year') {
        return `${y}`;
    }
    return `${y}-${m}-${d}`;
}

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const periodType = searchParams.get('period') || 'day';

        // Fetch Service details and employees
        const [[serviceRows], [employeeRows]] = await Promise.all([
            pool.execute('SELECT * FROM services WHERE id = ?', [id]),
            pool.execute('SELECT * FROM service_employees WHERE service_id = ? ORDER BY employee_name ASC', [id])
        ]);

        const serviceName = serviceRows[0]?.name || 'Service Portal';

        // Fetch tasks and work logs
        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code AS order_code, 
                    so.total_amount AS order_total_amount,
                    COALESCE(so.customer_name, jt.customer_name) AS customer_name, 
                    so.status AS order_status
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.service_id = ?
             ORDER BY jt.created_at DESC`,
            [id]
        );

        const taskIds = tasks.map(t => t.id);
        let workLogsMap = {};
        if (taskIds.length > 0) {
            const [allLogs] = await pool.execute(
                `SELECT * FROM job_task_work_logs WHERE task_id IN (${taskIds.map(() => '?').join(',')}) ORDER BY started_at ASC`,
                taskIds
            );
            for (const log of allLogs) {
                if (!workLogsMap[log.task_id]) workLogsMap[log.task_id] = [];
                workLogsMap[log.task_id].push(log);
            }
        }

        // Aggregate employee stats and period matrix
        const empMap = {};
        const periodsSet = new Set();
        const matrix = {};

        employeeRows.forEach(emp => {
            const name = emp.employee_name;
            empMap[name] = {
                id: emp.id || name,
                name: name,
                hourlyRate: Number(emp.rate || 0),
                role: emp.role || 'Technician',
                loggedSeconds: 0,
                laborValue: 0,
                soRevenueValue: 0,
                tasksCount: 0,
                completedTasksCount: 0,
                totalEstMinutes: 0,
                totalActMinutes: 0,
            };
        });

        tasks.forEach(task => {
            const orderRev = Number(task.order_total_amount || task.total_amount || 0);
            const taskEstM = Number(task.estimated_minutes || 0);
            const taskActSecs = Number(task.actual_seconds || 0);
            const logs = workLogsMap[task.id] || [];

            let totalTaskSecs = 0;
            const taskEmpSecs = {};
            logs.forEach(l => {
                if (l.employee_name) {
                    const secs = Number(l.duration_seconds || 0);
                    taskEmpSecs[l.employee_name] = (taskEmpSecs[l.employee_name] || 0) + secs;
                    totalTaskSecs += secs;
                }
            });
            if (totalTaskSecs === 0) totalTaskSecs = taskActSecs;

            if (logs.length > 0) {
                logs.forEach(log => {
                    const empName = log.employee_name;
                    if (!empName) return;
                    const secs = Number(log.duration_seconds || 0);
                    const logDate = log.started_at || task.created_at;
                    const pKey = getPeriodKey(logDate, periodType);
                    periodsSet.add(pKey);

                    if (!empMap[empName]) {
                        empMap[empName] = {
                            id: empName,
                            name: empName,
                            hourlyRate: 0,
                            role: 'Technician',
                            loggedSeconds: 0,
                            laborValue: 0,
                            soRevenueValue: 0,
                            tasksCount: 0,
                            completedTasksCount: 0,
                            totalEstMinutes: 0,
                            totalActMinutes: 0,
                        };
                    }

                    const hrs = secs / 3600;
                    const rate = empMap[empName].hourlyRate;
                    const laborVal = hrs * rate;
                    const share = totalTaskSecs > 0 ? (secs / totalTaskSecs) : 0;
                    const revVal = orderRev * share;

                    empMap[empName].loggedSeconds += secs;
                    empMap[empName].laborValue += laborVal;
                    empMap[empName].soRevenueValue += revVal;
                    empMap[empName].totalActMinutes += Math.round(secs / 60);

                    if (!matrix[pKey]) matrix[pKey] = {};
                    if (!matrix[pKey][empName]) matrix[pKey][empName] = { hours: 0, laborValue: 0, revValue: 0 };
                    matrix[pKey][empName].hours += hrs;
                    matrix[pKey][empName].laborValue += laborVal;
                    matrix[pKey][empName].revValue += revVal;
                });
            } else if (task.assigned_to) {
                const empName = task.assigned_to;
                const pKey = getPeriodKey(task.created_at, periodType);
                periodsSet.add(pKey);

                if (!empMap[empName]) {
                    empMap[empName] = {
                        id: empName,
                        name: empName,
                        hourlyRate: 0,
                        role: 'Technician',
                        loggedSeconds: 0,
                        laborValue: 0,
                        soRevenueValue: 0,
                        tasksCount: 0,
                        completedTasksCount: 0,
                        totalEstMinutes: 0,
                        totalActMinutes: 0,
                    };
                }

                const secs = taskActSecs;
                const hrs = secs / 3600;
                const rate = empMap[empName].hourlyRate;
                const laborVal = hrs * rate;

                empMap[empName].loggedSeconds += secs;
                empMap[empName].laborValue += laborVal;
                empMap[empName].soRevenueValue += orderRev;
                empMap[empName].totalEstMinutes += taskEstM;
                empMap[empName].totalActMinutes += Math.round(secs / 60);
                empMap[empName].tasksCount += 1;
                if (task.status === 'done') empMap[empName].completedTasksCount += 1;

                if (!matrix[pKey]) matrix[pKey] = {};
                if (!matrix[pKey][empName]) matrix[pKey][empName] = { hours: 0, laborValue: 0, revValue: 0 };
                matrix[pKey][empName].hours += hrs;
                matrix[pKey][empName].laborValue += laborVal;
                matrix[pKey][empName].revValue += orderRev;
            }
        });

        const employeeSummaryList = Object.values(empMap).map(emp => {
            const loggedHours = Math.round((emp.loggedSeconds / 3600) * 10) / 10;
            const laborValue = Math.round(emp.laborValue || (loggedHours * emp.hourlyRate));
            const soRevenueValue = Math.round(emp.soRevenueValue);
            const grossMargin = soRevenueValue - laborValue;
            const marginPct = soRevenueValue > 0 ? Math.round((grossMargin / soRevenueValue) * 100) : 0;
            const efficiencyPct = (emp.totalActMinutes > 0 && emp.totalEstMinutes > 0)
                ? Math.round((emp.totalEstMinutes / emp.totalActMinutes) * 100)
                : null;

            return {
                ...emp,
                loggedHours,
                laborValue,
                soRevenueValue,
                grossMargin,
                marginPct,
                efficiencyPct,
            };
        });

        let totalHrs = 0;
        let totalLaborVal = 0;
        let totalSoRev = 0;
        employeeSummaryList.forEach(e => {
            totalHrs += e.loggedHours;
            totalLaborVal += e.laborValue;
            totalSoRev += e.soRevenueValue;
        });

        const totals = {
            totalHrs: Math.round(totalHrs * 10) / 10,
            totalLaborVal,
            totalSoRev,
        };

        const sortedPeriods = Array.from(periodsSet).sort().reverse().slice(0, 10);

        const pdfBuffer = await renderToBuffer(
            <EmployeeDailyReportPdfDocument
                serviceName={serviceName}
                periodType={periodType}
                totals={totals}
                employees={employeeSummaryList}
                periodMatrix={matrix}
                uniquePeriods={sortedPeriods}
            />
        );

        return new Response(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Employee_Daily_Production_Report_${periodType}.pdf"`,
            },
        });
    } catch (err) {
        console.error('Error generating Employee Production Report PDF:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
