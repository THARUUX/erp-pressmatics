import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date'); // Optional: YYYY-MM-DD

        // 1. Fetch all active employees with ZKTeco mapping (excluding "PT" in name)
        const [employees] = await pool.execute(`
            SELECT e.id, e.employee_id as erp_code, e.name, e.job_title, e.department, e.shift, e.status, 
                   GROUP_CONCAT(m.device_user_id) as device_user_ids
            FROM employees e
            LEFT JOIN employee_zkteco_mapping m ON e.id = m.employee_id
            WHERE e.status = 'active' AND e.name NOT LIKE BINARY '%PT%'
            GROUP BY e.id
            ORDER BY e.name ASC
        `);

        // 2. Determine target date (D), previous date (D-1), and next date (D+1)
        let targetDateStr = dateParam;
        if (!targetDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
            // Default: today in IST (+05:30)
            const now = new Date();
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istNow = new Date(now.getTime() + istOffset);
            targetDateStr = istNow.toISOString().slice(0, 10);
        }

        const dObj = new Date(targetDateStr + 'T00:00:00Z');
        const prevDObj = new Date(dObj.getTime() - 24 * 60 * 60 * 1000);
        const nextDObj = new Date(dObj.getTime() + 24 * 60 * 60 * 1000);
        const prevDateStr = prevDObj.toISOString().slice(0, 10);
        const nextDateStr = nextDObj.toISOString().slice(0, 10);

        // Fetch attendance logs for Previous Date (D-1), Target Date (D), and Next Date (D+1)
        const [logs] = await pool.execute(`
            SELECT device_user_id, timestamp, state, verification_type
            FROM zkteco_attendance_logs
            WHERE timestamp >= CONCAT(?, ' 00:00:00') AND timestamp <= CONCAT(?, ' 23:59:59') AND state IN (0, 1, 4, 5)
            ORDER BY timestamp ASC
        `, [prevDateStr, nextDateStr]);

        // Group logs by device_user_id and separate by date string
        const prevDayLogsMap = {};
        const targetLogsMap = {};
        const nextDayLogsMap = {};

        for (const log of logs) {
            const devId = String(log.device_user_id);
            // Format log timestamp string to extract YYYY-MM-DD
            const d = new Date(log.timestamp);
            const tsDateStr = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : String(log.timestamp).slice(0, 10);

            if (tsDateStr === prevDateStr) {
                if (!prevDayLogsMap[devId]) prevDayLogsMap[devId] = [];
                prevDayLogsMap[devId].push(log);
            } else if (tsDateStr === targetDateStr) {
                if (!targetLogsMap[devId]) targetLogsMap[devId] = [];
                targetLogsMap[devId].push(log);
            } else if (tsDateStr === nextDateStr) {
                if (!nextDayLogsMap[devId]) nextDayLogsMap[devId] = [];
                nextDayLogsMap[devId].push(log);
            }
        }

        // Fetch approved leaves for Target Date (D)
        const [leaves] = await pool.execute(`
            SELECT employee_id
            FROM leaves
            WHERE status = 'approved' AND start_date <= ? AND end_date >= ?
        `, [targetDateStr, targetDateStr]);
        const approvedLeavesSet = new Set(leaves.map(l => l.employee_id));

        let checkedInCount = 0;
        let checkedOutCount = 0;
        let absentCount = 0;
        let onBreakCount = 0;
        let leaveCount = 0;
        let offCount = 0;

        const results = employees.map(emp => {
            const deviceIds = emp.device_user_ids ? emp.device_user_ids.split(',').map(id => id.trim()) : [];
            const prevLogs = [];
            const todayLogs = [];
            const nextLogs = [];

            // Gather all logs for this employee
            for (const devId of deviceIds) {
                prevLogs.push(...(prevDayLogsMap[devId] || []));
                todayLogs.push(...(targetLogsMap[devId] || []));
                nextLogs.push(...(nextDayLogsMap[devId] || []));
            }

            // Sort logs chronologically
            prevLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            todayLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            nextLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Overnight shift check for the previous day (D-1):
            // If the employee checked in on D-1, but had no check-out on D-1,
            // then any check-out today (D) before today's first check-in belongs to D-1.
            const prevFirstCheckIn = prevLogs.find(l => l.state === 0 || l.state === 5);
            const prevCheckOuts = prevLogs.filter(l => l.state === 1);
            const prevHasCheckOut = prevCheckOuts.length > 0 &&
                (prevFirstCheckIn ? new Date(prevCheckOuts[prevCheckOuts.length - 1].timestamp) > new Date(prevFirstCheckIn.timestamp) : false);

            let todayHadOvernightCheckOut = false;

            if (prevFirstCheckIn && !prevHasCheckOut) {
                const todayFirstCheckIn = todayLogs.find(l => l.state === 0 || l.state === 5);
                // Filter out any check-outs (state 1) on today that occur before today's first check-in
                // If there's no check-in today, filter out all check-outs (state 1) on today
                for (let i = todayLogs.length - 1; i >= 0; i--) {
                    const l = todayLogs[i];
                    if (l.state === 1) {
                        const isOvernightCheckOut = todayFirstCheckIn
                            ? new Date(l.timestamp) < new Date(todayFirstCheckIn.timestamp)
                            : true;
                        if (isOvernightCheckOut) {
                            todayHadOvernightCheckOut = true;
                            todayLogs.splice(i, 1);
                        }
                    }
                }
            }

            // Check if there is a Check In (state 0 or 5) on Target Date (D)
            const targetFirstCheckIn = todayLogs.find(l => l.state === 0 || l.state === 5);
            const targetCheckOuts = todayLogs.filter(l => l.state === 1);
            const hasCheckOutOnTargetDate = targetCheckOuts.length > 0 &&
                (targetFirstCheckIn ? new Date(targetCheckOuts[targetCheckOuts.length - 1].timestamp) > new Date(targetFirstCheckIn.timestamp) : false);

            // Overnight shift check: if checked in today but NO check-out today, check next day logs
            if (targetFirstCheckIn && !hasCheckOutOnTargetDate) {
                // Find the first Check In on next day
                const nextDayFirstCheckIn = nextLogs.find(l => l.state === 0 || l.state === 5);

                // Find a Check Out on next day that occurs BEFORE the first Check In of next day
                const overnightCheckOut = nextLogs.find(l => {
                    if (l.state !== 1) return false;
                    if (nextDayFirstCheckIn) {
                        return new Date(l.timestamp) < new Date(nextDayFirstCheckIn.timestamp);
                    }
                    return true;
                });

                if (overnightCheckOut) {
                    todayLogs.push({
                        ...overnightCheckOut,
                        isNextDay: true
                    });
                }
            }

            // Re-sort todayLogs after potential overnight check-out addition
            todayLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            const lastLog = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1] : null;

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
                if (approvedLeavesSet.has(emp.id)) {
                    status = 'Leave';
                    leaveCount++;
                } else if (todayHadOvernightCheckOut) {
                    status = 'Off';
                    offCount++;
                } else {
                    status = 'Absent';
                    absentCount++;
                }
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
                leave: leaveCount,
                off: offCount,
                absent: absentCount
            },
            employees: results
        });
    } catch (err) {
        console.error('[attendance/current-status GET]', err);
        return NextResponse.json({ error: 'Failed to fetch current status' }, { status: 500 });
    }
}
