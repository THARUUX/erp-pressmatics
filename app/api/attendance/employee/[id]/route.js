import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
    try {
        const { id } = await params; // Employee DB ID
        const { searchParams } = new URL(req.url);
        
        const now = new Date();
        const year = parseInt(searchParams.get('year') || now.getFullYear().toString(), 10);
        const month = parseInt(searchParams.get('month') || (now.getMonth() + 1).toString(), 10);

        // 1. Fetch employee details and device mapping
        const [[emp]] = await pool.execute(`
            SELECT e.id, e.name, e.employee_id as erp_code, e.job_title, e.department, 
                   e.standard_working_hours, GROUP_CONCAT(m.device_user_id) as device_user_ids
            FROM employees e
            LEFT JOIN employee_zkteco_mapping m ON e.id = m.employee_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [id]);

        if (!emp) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const deviceIds = emp.device_user_ids ? emp.device_user_ids.split(',') : [];
        const stdHours = parseFloat(emp.standard_working_hours || 8.00);

        // Calculate days in the month
        const daysInMonth = new Date(year, month, 0).getDate();
        const pad = (n) => String(n).padStart(2, '0');
        
        const startStr = `${year}-${pad(month)}-01 00:00:00`;
        const endStr = `${year}-${pad(month)}-${pad(daysInMonth)} 23:59:59`;

        const dailyReport = [];
        
        // Initialize all calendar days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${pad(month)}-${pad(d)}`;
            const dayOfWeek = new Date(dateStr).getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            dailyReport.push({
                date: dateStr,
                dayName: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
                checkIn: null,
                checkOut: null,
                totalHours: 0,
                overtimeHours: 0,
                status: isWeekend ? 'Weekly Off' : 'Absent',
                incomplete: false
            });
        }

        if (deviceIds.length > 0) {
            // Fetch logs for this employee (ignoring states 4 & 5)
            const [logs] = await pool.execute(`
                SELECT timestamp, state
                FROM zkteco_attendance_logs
                WHERE device_user_id IN (${deviceIds.map(() => '?').join(',')}) AND timestamp >= ? AND timestamp <= ? AND state IN (0, 1)
                ORDER BY timestamp ASC
            `, [...deviceIds, startStr, endStr]);

            // Group logs by date
            const logsByDate = {};
            for (const log of logs) {
                const datePart = log.timestamp.toISOString().split('T')[0];
                if (!logsByDate[datePart]) logsByDate[datePart] = [];
                logsByDate[datePart].push(log);
            }

            // Process each day
            for (const item of dailyReport) {
                const dayLogs = logsByDate[item.date];
                if (!dayLogs || dayLogs.length === 0) continue;

                let checkInTime = null;
                let checkOutTime = null;
                let dailyHours = 0;
                let incomplete = false;

                // Simple pairing: find first check-in and last check-out
                const checkIns = dayLogs.filter(l => l.state === 0);
                const checkOuts = dayLogs.filter(l => l.state === 1);

                if (checkIns.length > 0) {
                    checkInTime = new Date(checkIns[0].timestamp);
                }
                if (checkOuts.length > 0) {
                    checkOutTime = new Date(checkOuts[checkOuts.length - 1].timestamp);
                }

                if (checkInTime && checkOutTime) {
                    if (checkOutTime.getTime() >= checkInTime.getTime()) {
                        const diffMs = checkOutTime.getTime() - checkInTime.getTime();
                        dailyHours = diffMs / (1000 * 60 * 60);
                        item.status = 'Present';
                    } else {
                        // Out before in, count as incomplete
                        incomplete = true;
                        item.status = 'Incomplete';
                    }
                } else if (checkInTime || checkOutTime) {
                    incomplete = true;
                    item.status = 'Incomplete';
                }

                let overtime = 0;
                if (dailyHours > stdHours) {
                    overtime = dailyHours - stdHours;
                }

                item.checkIn = checkInTime ? checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : null;
                item.checkOut = checkOutTime ? checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : null;
                item.totalHours = parseFloat(dailyHours.toFixed(2));
                item.overtimeHours = parseFloat(overtime.toFixed(2));
                item.incomplete = incomplete;
            }
        }

        // Summary calculations
        const totalPresent = dailyReport.filter(r => r.status === 'Present').length;
        const totalAbsent = dailyReport.filter(r => r.status === 'Absent').length;
        const totalIncomplete = dailyReport.filter(r => r.incomplete).length;
        const totalHoursWorked = dailyReport.reduce((sum, r) => sum + r.totalHours, 0);
        const totalOvertimeWorked = dailyReport.reduce((sum, r) => sum + r.overtimeHours, 0);

        return NextResponse.json({
            employee: {
                id: emp.id,
                name: emp.name,
                erp_code: emp.erp_code,
                department: emp.department,
                job_title: emp.job_title,
                device_user_id: deviceIds.join(', ')
            },
            summary: {
                present: totalPresent,
                absent: totalAbsent,
                incomplete: totalIncomplete,
                totalHours: parseFloat(totalHoursWorked.toFixed(2)),
                totalOvertime: parseFloat(totalOvertimeWorked.toFixed(2))
            },
            days: dailyReport
        });
    } catch (err) {
        console.error('[attendance/employee/:id GET]', err);
        return NextResponse.json({ error: 'Failed to generate employee report' }, { status: 500 });
    }
}
