import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Fetch all active employees with ZKTeco mapping
        const [employees] = await pool.execute(`
            SELECT e.id, e.employee_id as erp_code, e.name, e.job_title, e.department, e.shift, e.status, 
                   GROUP_CONCAT(m.device_user_id) as device_user_ids
            FROM employees e
            LEFT JOIN employee_zkteco_mapping m ON e.id = m.employee_id
            WHERE e.status = 'active'
            GROUP BY e.id
            ORDER BY e.name ASC
        `);

        // 2. Fetch all attendance logs from today (including states 0, 1, 4, 5)
        const [logs] = await pool.execute(`
            SELECT device_user_id, timestamp, state, verification_type
            FROM zkteco_attendance_logs
            WHERE timestamp >= CONCAT(DATE(CONVERT_TZ(NOW(), '+00:00', '+05:30')), ' 00:00:00') AND state IN (0, 1, 4, 5)
            ORDER BY timestamp ASC
        `);

        // 3. Map latest daily log and group logs for each device user
        const latestLogsMap = {};
        const logsByEmployee = {};
        
        for (const log of logs) {
            latestLogsMap[log.device_user_id] = log;
            if (!logsByEmployee[log.device_user_id]) {
                logsByEmployee[log.device_user_id] = [];
            }
            logsByEmployee[log.device_user_id].push({
                timestamp: log.timestamp,
                state: log.state,
                verification_type: log.verification_type
            });
        }

        let checkedInCount = 0;
        let checkedOutCount = 0;
        let absentCount = 0;
        let onBreakCount = 0;

        const results = employees.map(emp => {
            const deviceIds = emp.device_user_ids ? emp.device_user_ids.split(',') : [];
            const hasMapping = deviceIds.length > 0;
            
            let lastLog = null;
            const todayLogs = [];

            for (const devId of deviceIds) {
                const devLastLog = latestLogsMap[devId];
                if (devLastLog) {
                    if (!lastLog || new Date(devLastLog.timestamp) > new Date(lastLog.timestamp)) {
                        lastLog = devLastLog;
                    }
                }
                const devTodayLogs = logsByEmployee[devId] || [];
                todayLogs.push(...devTodayLogs);
            }

            // Sort todayLogs chronologically
            todayLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            let status = 'Absent';
            let lastPunchTime = null;
            let lastPunchState = null;

            if (lastLog) {
                lastPunchTime = lastLog.timestamp;
                lastPunchState = lastLog.state;
                if (lastLog.state === 0 || lastLog.state === 5) {
                    status = 'Checked In';
                    checkedInCount++;
                } else if (lastLog.state === 4) {
                    status = 'On Break';
                    onBreakCount++;
                } else if (lastLog.state === 1) {
                    status = 'Checked Out';
                    checkedOutCount++;
                }
            } else {
                absentCount++;
            }

            return {
                id: emp.id,
                erp_code: emp.erp_code,
                name: emp.name,
                job_title: emp.job_title,
                department: emp.department,
                shift: emp.shift,
                device_user_id: deviceIds.join(', '),
                status,
                lastPunchTime,
                lastPunchState,
                todayLogs
            };
        });

        return NextResponse.json({
            summary: {
                totalActive: employees.length,
                checkedIn: checkedInCount,
                checkedOut: checkedOutCount,
                onBreak: onBreakCount,
                absent: absentCount
            },
            employees: results
        });
    } catch (err) {
        console.error('[attendance/current-status GET]', err);
        return NextResponse.json({ error: 'Failed to fetch current status' }, { status: 500 });
    }
}
