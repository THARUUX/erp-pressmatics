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
            const firstDayObj = new Date(year, month - 1, 1);
            const prevDayObj = new Date(firstDayObj.getTime() - 24 * 60 * 60 * 1000);
            const fetchStartStr = `${prevDayObj.getFullYear()}-${pad(prevDayObj.getMonth() + 1)}-${pad(prevDayObj.getDate())} 00:00:00`;

            const endDayObj = new Date(year, month - 1, daysInMonth + 1);
            const endStrPlusOne = `${endDayObj.getFullYear()}-${pad(endDayObj.getMonth() + 1)}-${pad(endDayObj.getDate())} 23:59:59`;

            // Fetch logs for this employee (ignoring states 4 & 5)
            const [logs] = await pool.execute(`
                SELECT timestamp, state
                FROM zkteco_attendance_logs
                WHERE device_user_id IN (${deviceIds.map(() => '?').join(',')}) AND timestamp >= ? AND timestamp <= ? AND state IN (0, 1)
                ORDER BY timestamp ASC
            `, [...deviceIds, fetchStartStr, endStrPlusOne]);

            // Group logs by date
            const logsByDate = {};
            for (const log of logs) {
                const datePart = log.timestamp.toISOString().split('T')[0];
                if (!logsByDate[datePart]) logsByDate[datePart] = [];
                logsByDate[datePart].push(log);
            }

            // Fetch all approved leaves for this employee that overlap with the range
            const [leaves] = await pool.execute(`
                SELECT start_date, end_date
                FROM leaves
                WHERE employee_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?
            `, [id, endStrPlusOne.slice(0, 10), fetchStartStr.slice(0, 10)]);

            const leaveDates = new Set();
            for (const leave of leaves) {
                const start = new Date(leave.start_date + 'T00:00:00Z');
                const end = new Date(leave.end_date + 'T00:00:00Z');
                for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
                    leaveDates.add(d.toISOString().slice(0, 10));
                }
            }

            const getOffsetDateStr = (dateStr, offsetDays) => {
                const d = new Date(dateStr + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + offsetDays);
                return d.toISOString().slice(0, 10);
            };

            // Process each day
            for (const item of dailyReport) {
                const dayLogs = [...(logsByDate[item.date] || [])];

                // Overnight shift check for the previous day (d-1):
                // If the employee checked in on d-1, but had no check-out on d-1,
                // then any check-out today (d) before today's first check-in belongs to d-1.
                const prevDateStr = getOffsetDateStr(item.date, -1);
                const prevDayLogs = logsByDate[prevDateStr] || [];
                const prevFirstCheckIn = prevDayLogs.find(l => l.state === 0);
                const prevCheckOuts = prevDayLogs.filter(l => l.state === 1);
                const prevHasCheckOut = prevCheckOuts.length > 0 &&
                    (prevFirstCheckIn ? new Date(prevCheckOuts[prevCheckOuts.length - 1].timestamp).getTime() > new Date(prevFirstCheckIn.timestamp).getTime() : false);

                let todayHadOvernightCheckOut = false;

                if (prevFirstCheckIn && !prevHasCheckOut) {
                    const todayFirstCheckIn = dayLogs.find(l => l.state === 0);
                    // Filter out any check-outs (state 1) on today that occur before today's first check-in
                    // If no check-in today, filter out all check-outs on today
                    for (let i = dayLogs.length - 1; i >= 0; i--) {
                        const l = dayLogs[i];
                        if (l.state === 1) {
                            const isOvernightCheckOut = todayFirstCheckIn
                                ? new Date(l.timestamp).getTime() < new Date(todayFirstCheckIn.timestamp).getTime()
                                : true;
                            if (isOvernightCheckOut) {
                                todayHadOvernightCheckOut = true;
                                dayLogs.splice(i, 1);
                            }
                        }
                    }
                }

                if (dayLogs.length === 0) {
                    if (leaveDates.has(item.date)) {
                        item.status = 'Leave';
                    } else if (todayHadOvernightCheckOut) {
                        item.status = 'Off';
                    }
                    continue;
                }

                let checkInTime = null;
                let checkOutTime = null;
                let dailyHours = 0;
                let incomplete = false;

                // Simple pairing: find first check-in and last check-out
                const checkIns = dayLogs.filter(l => l.state === 0);
                const checkOuts = dayLogs.filter(l => l.state === 1);

                let firstCheckIn = checkIns.length > 0 ? checkIns[0] : null;
                let lastCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1] : null;

                if (firstCheckIn) {
                    checkInTime = new Date(firstCheckIn.timestamp);
                }

                const hasCheckOutOnTargetDate = lastCheckOut && firstCheckIn && (new Date(lastCheckOut.timestamp).getTime() > new Date(firstCheckIn.timestamp).getTime());

                // If checked in today but NO valid check-out today, check next day logs
                if (firstCheckIn && !hasCheckOutOnTargetDate) {
                    const nextDayStr = getOffsetDateStr(item.date, 1);
                    const nextDayLogs = logsByDate[nextDayStr] || [];
                    const nextDayFirstCheckIn = nextDayLogs.find(l => l.state === 0);

                    // Find a Check Out on next day that occurs BEFORE the first Check In of next day
                    const overnightCheckOut = nextDayLogs.find(l => {
                        if (l.state !== 1) return false;
                        if (nextDayFirstCheckIn) {
                            return new Date(l.timestamp).getTime() < new Date(nextDayFirstCheckIn.timestamp).getTime();
                        }
                        return true;
                    });

                    if (overnightCheckOut) {
                        lastCheckOut = overnightCheckOut;
                    }
                }

                if (lastCheckOut) {
                    checkOutTime = new Date(lastCheckOut.timestamp);
                } else if (checkOuts.length > 0 && !checkOutTime) {
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
                        checkOutTime = null; // Neglect check-out time since it is before check-in time
                    }
                } else if (checkInTime || checkOutTime) {
                    incomplete = true;
                    item.status = 'Incomplete';
                }

                if (item.status === 'Absent' && leaveDates.has(item.date)) {
                    item.status = 'Leave';
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
        const totalAbsent = dailyReport.filter(r => r.status === 'Off').length;
        const totalLeave = dailyReport.filter(r => r.status === 'Leave').length;
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
                leave: totalLeave,
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
