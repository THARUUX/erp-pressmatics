import { renderToBuffer } from '@react-pdf/renderer';
import pool from '@/lib/db';
import EmployeeTasksReportPdfDocument from './EmployeeTasksReportPdfDocument';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const filterEmpName = searchParams.get('employeeName');
        const columnsParam = searchParams.get('columns'); // e.g. "code,customer,name,status,est_time,act_time,variance,cost"
        const statusesParam = searchParams.get('statuses'); // e.g. "done,in_progress,pending"

        const selectedColumns = columnsParam ? columnsParam.split(',').map(c => c.trim()) : ['code', 'customer', 'name', 'status', 'est_time', 'act_time', 'variance', 'cost'];
        const allowedStatuses = statusesParam ? statusesParam.split(',').map(s => s.trim()) : null;

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

        // Group tasks by employee
        const empMap = {};
        employeeRows.forEach(emp => {
            let empName = emp.employee_name;
            if (empName.toLowerCase() === 'operator') empName = 'Unplanned';
            empMap[empName] = {
                name: empName,
                hourlyRate: Number(emp.rate || 0),
                role: emp.role || 'Technician',
                tasks: [],
                totalEstMins: 0,
                totalActMins: 0,
                totalLaborVal: 0,
            };
        });

        // Build employee names list for matching unassigned task names
        const empNamesList = employeeRows.map(e => e.employee_name);

        tasks.forEach(task => {
            let taskStatus = task.status || 'pending';
            const effectiveStatus = taskStatus === 'paused' ? 'in_progress' : taskStatus;

            // Apply status filter if specified
            if (allowedStatuses && allowedStatuses.length > 0) {
                if (!allowedStatuses.includes(effectiveStatus) && !allowedStatuses.includes(taskStatus)) return;
            }

            const logs = workLogsMap[task.id] || [];
            if (logs.length > 0) {
                const empSecsMap = {};
                logs.forEach(l => {
                    if (l.employee_name) {
                        let empName = l.employee_name;
                        if (empName.toLowerCase() === 'operator') empName = 'Unplanned';
                        empSecsMap[empName] = (empSecsMap[empName] || 0) + Number(l.duration_seconds || 0);
                    }
                });

                Object.entries(empSecsMap).forEach(([empName, secs]) => {
                    if (!empMap[empName]) {
                        empMap[empName] = {
                            name: empName,
                            hourlyRate: 0,
                            role: 'Technician',
                            tasks: [],
                            totalEstMins: 0,
                            totalActMins: 0,
                            totalLaborVal: 0,
                        };
                    }
                    const actMins = Math.round(secs / 60);
                    const laborVal = Math.round((secs / 3600) * empMap[empName].hourlyRate);

                    empMap[empName].tasks.push({
                        ...task,
                        empActualMins: actMins,
                    });
                    empMap[empName].totalEstMins += Number(task.estimated_minutes || 0);
                    empMap[empName].totalActMins += actMins;
                    empMap[empName].totalLaborVal += laborVal;
                });
            } else {
                let empName = task.assigned_to;
                if (!empName) {
                    const nameAfterDash = task.name?.split('—')?.[1]?.trim() || task.name?.split('-')?.[1]?.trim();
                    if (nameAfterDash) {
                        const matched = empNamesList.find(n => n.toLowerCase() === nameAfterDash.toLowerCase());
                        if (matched) empName = matched;
                    }
                }
                if (!empName) empName = 'Unplanned';
                if (empName.toLowerCase() === 'operator') empName = 'Unplanned';

                if (!empMap[empName]) {
                    empMap[empName] = {
                        name: empName,
                        hourlyRate: 0,
                        role: 'Technician',
                        tasks: [],
                        totalEstMins: 0,
                        totalActMins: 0,
                        totalLaborVal: 0,
                    };
                }
                const secs = Number(task.actual_seconds || 0);
                const actMins = Math.round(secs / 60);
                const laborVal = Math.round((secs / 3600) * empMap[empName].hourlyRate);

                empMap[empName].tasks.push({
                    ...task,
                    empActualMins: actMins,
                });
                empMap[empName].totalEstMins += Number(task.estimated_minutes || 0);
                empMap[empName].totalActMins += actMins;
                empMap[empName].totalLaborVal += laborVal;
            }
        });

        let employeesData = Object.values(empMap).filter(e => e.tasks.length > 0);
        if (filterEmpName && filterEmpName !== 'all') {
            const target = filterEmpName.toLowerCase();
            employeesData = employeesData.filter(e => 
                e.name.toLowerCase() === target || 
                (target === 'operator' && e.name.toLowerCase() === 'unplanned')
            );
        }

        const pdfBuffer = await renderToBuffer(
            <EmployeeTasksReportPdfDocument
                serviceName={serviceName}
                employeesData={employeesData}
                selectedColumns={selectedColumns}
            />
        );

        return new Response(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Employee_Wise_Task_Report.pdf"`,
            },
        });
    } catch (err) {
        console.error('Error generating Employee Tasks Report PDF:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
