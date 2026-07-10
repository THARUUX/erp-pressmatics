import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Helper to format date strings to YYYY-MM-DD
const formatDateStr = (date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
};

// ── GET /api/payroll/runs ─────────────────────────────────────────────────────
export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT r.*, 
                   COUNT(p.id) AS employee_count,
                   SUM(p.net_pay) AS total_payroll_amount
            FROM payroll_runs r
            LEFT JOIN payslips p ON r.id = p.payroll_run_id
            GROUP BY r.id
            ORDER BY r.year DESC, r.month DESC
        `);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[payroll/runs GET]', err);
        return NextResponse.json({ error: 'Failed to fetch payroll runs' }, { status: 500 });
    }
}

// ── POST /api/payroll/runs ────────────────────────────────────────────────────
export async function POST(req) {
    let connection;
    try {
        const body = await req.json();
        const { year, month } = body;

        if (!year || !month) {
            return NextResponse.json({ error: 'Year and Month are required' }, { status: 400 });
        }

        // Check if run already exists
        const [[existingRun]] = await pool.execute(
            'SELECT id FROM payroll_runs WHERE year = ? AND month = ?',
            [year, month]
        );

        if (existingRun) {
            return NextResponse.json({ 
                error: 'Payroll has already been generated for this period. Delete the existing run first to recalculate.' 
            }, { status: 400 });
        }

        // Fetch all active employees
        const [employees] = await pool.execute(`
            SELECT e.*, m.device_user_id
            FROM employees e
            LEFT JOIN employee_zkteco_mapping m ON e.id = m.employee_id
            WHERE e.status = 'active'
        `);

        if (employees.length === 0) {
            return NextResponse.json({ error: 'No active employees found to generate payroll for.' }, { status: 400 });
        }

        // Determine date range for logs
        const pad = (n) => String(n).padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        const startStr = `${year}-${pad(month)}-01 00:00:00`;
        const endStr = `${year}-${pad(month)}-${pad(lastDay)} 23:59:59`;

        // Fetch attendance logs for this period (ignoring states 4 & 5)
        const [logs] = await pool.execute(`
            SELECT device_user_id, timestamp, state
            FROM zkteco_attendance_logs
            WHERE timestamp >= ? AND timestamp <= ? AND state IN (0, 1)
            ORDER BY timestamp ASC
        `, [startStr, endStr]);

        // Group logs by device_user_id and date
        const logsByUser = {};
        for (const log of logs) {
            const userId = log.device_user_id;
            const dateStr = formatDateStr(log.timestamp);
            if (!dateStr) continue;

            if (!logsByUser[userId]) logsByUser[userId] = {};
            if (!logsByUser[userId][dateStr]) logsByUser[userId][dateStr] = [];
            logsByUser[userId][dateStr].push(log);
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Create the Payroll Run
        const [runResult] = await connection.execute(
            'INSERT INTO payroll_runs (year, month, status) VALUES (?, ?, ?)',
            [year, month, 'draft']
        );
        const runId = runResult.insertId;

        // 2. Calculate and generate payslip for each employee
        const warnings = [];
        for (const emp of employees) {
            const userId = emp.device_user_id;
            let totalHours = 0;
            let totalOTHours = 0;

            const stdHours = parseFloat(emp.standard_working_hours || 8.00);
            const otMult = parseFloat(emp.ot_rate_multiplier || 1.50);

            if (userId && logsByUser[userId]) {
                const userDates = logsByUser[userId];
                for (const dateStr in userDates) {
                    const dayLogs = userDates[dateStr]; // Already chronologically sorted
                    let dailyHours = 0;
                    let lastCheckIn = null;

                    for (const log of dayLogs) {
                        if (log.state === 0) { // Check In
                            // If we already checked in, keep the earliest one for the daily calculation
                            if (lastCheckIn === null) {
                                lastCheckIn = new Date(log.timestamp);
                            }
                        } else if (log.state === 1) { // Check Out
                            if (lastCheckIn !== null) {
                                const checkOut = new Date(log.timestamp);
                                const diffMs = checkOut.getTime() - lastCheckIn.getTime();
                                const diffHrs = Math.max(0, diffMs / (1000 * 60 * 60));
                                dailyHours += diffHrs;
                                lastCheckIn = null; // Reset check in
                            } else {
                                warnings.push(`${emp.name}: Check-out without check-in on ${dateStr}`);
                            }
                        }
                    }

                    if (lastCheckIn !== null) {
                        warnings.push(`${emp.name}: Check-in without check-out on ${dateStr}`);
                    }

                    // Daily Overtime Calculation
                    let dailyOT = 0;
                    if (dailyHours > stdHours) {
                        dailyOT = dailyHours - stdHours;
                    }
                    
                    totalHours += dailyHours;
                    totalOTHours += dailyOT;
                }
            }

            // Pay calculations
            const payType = emp.pay_type || 'monthly';
            const baseSalary = parseFloat(emp.base_salary || 0.00);
            const hourlyRate = parseFloat(emp.hourly_rate || 0.00);
            const allowances = parseFloat(emp.allowances || 0.00);
            const deductions = parseFloat(emp.deductions || 0.00);

            let regularPay = 0;
            let otPay = 0;

            if (payType === 'hourly') {
                const regularHours = Math.max(0, totalHours - totalOTHours);
                regularPay = regularHours * hourlyRate;
                otPay = totalOTHours * (hourlyRate * otMult);
            } else { // monthly salaried
                regularPay = baseSalary;
                // Compute OT hourly rate: check if set, otherwise convert base salary assuming 22 days of 8 hours (176 hrs)
                const otHourlyRate = hourlyRate > 0 ? hourlyRate : (baseSalary / 176);
                otPay = totalOTHours * otHourlyRate * otMult;
            }

            const netPay = Math.max(0, (regularPay + otPay + allowances) - deductions);

            // Insert Payslip
            await connection.execute(`
                INSERT INTO payslips (
                    payroll_run_id, employee_id, pay_type, base_salary, hourly_rate, 
                    total_hours_worked, overtime_hours, overtime_pay, allowances, deductions, net_pay, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                runId, emp.id, payType, baseSalary, hourlyRate,
                totalHours, totalOTHours, otPay, allowances, deductions, netPay, 'draft'
            ]);
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            payrollRunId: runId,
            warnings: warnings.slice(0, 50) // Cap warnings count returned in API
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('[payroll/runs POST]', err);
        return NextResponse.json({ error: 'Failed to generate payroll: ' + err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
