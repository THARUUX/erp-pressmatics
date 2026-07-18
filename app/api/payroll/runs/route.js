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

        // Fetch all settings
        const [settingsRows] = await pool.execute('SELECT setting_key, setting_value FROM settings');
        const settings = {};
        settingsRows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        const epfEmployeePct = parseFloat(settings.epf_employee_pct || 8.00);
        const epfEmployerPct = parseFloat(settings.epf_employer_pct || 12.00);
        const etfEmployerPct = parseFloat(settings.etf_employer_pct || 3.00);
        const br1Amount = parseFloat(settings.br1_amount || 0.00);
        const br2Amount = parseFloat(settings.br2_amount || 0.00);
        const payeTaxEnabled = settings.paye_tax_enabled === 'true';
        let payeTaxBrackets = [];
        try {
            payeTaxBrackets = JSON.parse(settings.paye_tax_brackets || '[]');
        } catch {
            payeTaxBrackets = [];
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

        // Fetch holidays in the period
        const [holidayRows] = await pool.execute(
            'SELECT date FROM holidays WHERE date >= ? AND date <= ?',
            [startStr.split(' ')[0], endStr.split(' ')[0]]
        );
        const holidayDates = new Set(holidayRows.map(h => formatDateStr(h.date)));

        // Fetch all approved leaves for this period
        const [leaveRows] = await pool.execute(
            `SELECT employee_id, start_date, end_date, leave_type 
             FROM leaves 
             WHERE status = 'approved' AND start_date <= ? AND end_date >= ?`,
            [endStr.split(' ')[0], startStr.split(' ')[0]]
        );
        const leavesMap = {};
        for (const l of leaveRows) {
            const empId = l.employee_id;
            if (!leavesMap[empId]) leavesMap[empId] = [];
            leavesMap[empId].push({
                start: new Date(l.start_date),
                end: new Date(l.end_date),
                type: l.leave_type
            });
        }

        const hasApprovedLeave = (empId, dateStr) => {
            const empLeaves = leavesMap[empId] || [];
            const target = new Date(dateStr);
            target.setHours(0, 0, 0, 0);
            for (const l of empLeaves) {
                const s = new Date(l.start);
                s.setHours(0, 0, 0, 0);
                const e = new Date(l.end);
                e.setHours(0, 0, 0, 0);
                if (target >= s && target <= e) {
                    return l.type; // 'casual', 'medical', 'annual', 'no-pay'
                }
            }
            return null;
        };

        // Fetch custom allowances and deductions
        const [customItems] = await pool.execute('SELECT * FROM employee_allowances_deductions');
        const customItemsMap = {};
        for (const item of customItems) {
            const empId = item.employee_id;
            if (!customItemsMap[empId]) customItemsMap[empId] = [];
            customItemsMap[empId].push(item);
        }

        // Fetch approved advances
        const [advanceRows] = await pool.execute(
            "SELECT * FROM salary_advances WHERE status = 'approved' AND deducted_payslip_id IS NULL"
        );
        const advancesMap = {};
        for (const adv of advanceRows) {
            const empId = adv.employee_id;
            if (!advancesMap[empId]) advancesMap[empId] = [];
            advancesMap[empId].push(adv);
        }

        // Fetch active loans
        const [loanRows] = await pool.execute(
            "SELECT * FROM employee_loans WHERE status = 'active'"
        );
        const loansMap = {};
        for (const loan of loanRows) {
            const empId = loan.employee_id;
            if (!loansMap[empId]) loansMap[empId] = [];
            loansMap[empId].push(loan);
        }

        // Fetch attendance logs for this period
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

        const warnings = [];

        // 2. Loop through all employees and generate payslips
        for (const emp of employees) {
            const userId = emp.device_user_id;
            
            let totalHoursWorked = 0;
            let normalOTHours = 0;
            let doubleOTHours = 0;
            let lateHours = 0;
            let noPayDays = 0;

            const stdHours = parseFloat(emp.standard_working_hours || 8.00);
            const workingDaysList = (emp.working_days || 'Monday,Tuesday,Wednesday,Thursday,Friday').split(',');

            // Daily tracking
            for (let day = 1; day <= lastDay; day++) {
                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                const dObj = new Date(dateStr);
                const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });

                const isNonWorkingDay = !workingDaysList.includes(dayName);
                const isMarkedHoliday = holidayDates.has(dateStr);
                const isHoliday = isNonWorkingDay || isMarkedHoliday;

                let dayHours = 0;
                if (userId && logsByUser[userId] && logsByUser[userId][dateStr]) {
                    const dayLogs = logsByUser[userId][dateStr];
                    let lastCheckIn = null;

                    for (const log of dayLogs) {
                        if (log.state === 0) { // Check In
                            if (lastCheckIn === null) {
                                lastCheckIn = new Date(log.timestamp);
                            }
                        } else if (log.state === 1) { // Check Out
                            if (lastCheckIn !== null) {
                                const diffMs = new Date(log.timestamp).getTime() - lastCheckIn.getTime();
                                dayHours += Math.max(0, diffMs / (1000 * 60 * 60));
                                lastCheckIn = null;
                            } else {
                                warnings.push(`${emp.name}: Check-out without check-in on ${dateStr}`);
                            }
                        }
                    }

                    if (lastCheckIn !== null) {
                        warnings.push(`${emp.name}: Check-in without check-out on ${dateStr}`);
                    }
                }

                if (isHoliday) {
                    if (dayHours > 0) {
                        doubleOTHours += dayHours;
                    }
                } else { // Normal working day
                    if (dayHours > 0) {
                        totalHoursWorked += dayHours;
                        if (dayHours > stdHours) {
                            normalOTHours += (dayHours - stdHours);
                        } else if (dayHours < stdHours) {
                            lateHours += (stdHours - dayHours);
                        }
                    } else {
                        // Absent. Check approved leave
                        const leaveType = hasApprovedLeave(emp.id, dateStr);
                        if (leaveType) {
                            if (leaveType === 'no-pay') {
                                noPayDays++;
                            }
                        } else {
                            noPayDays++;
                        }
                    }
                }
            }

            // Calculation
            const baseSalary = parseFloat(emp.base_salary || 0.00);
            
            // Hourly rates
            const otMult = parseFloat(emp.ot_rate_multiplier || 1.50);
            const otRate = parseFloat(emp.ot_rate || 0) > 0 ? parseFloat(emp.ot_rate) : (baseSalary / 176) * otMult;
            const doubleOTRate = parseFloat(emp.double_ot_rate || 0) > 0 ? parseFloat(emp.double_ot_rate) : otRate * 2.0;
            const lateRate = parseFloat(emp.late_deduction_rate || 0) > 0 ? parseFloat(emp.late_deduction_rate) : (baseSalary / 176);

            const normalOTPay = normalOTHours * otRate;
            const doubleOTPay = doubleOTHours * doubleOTRate;
            const lateDeductionPay = lateHours * lateRate;

            // No pay deduction
            const noPayVal = parseFloat(emp.no_pay_value || 0);
            let noPayDeduction = 0;
            if (noPayDays > 0) {
                if (emp.no_pay_type === 'fixed') {
                    noPayDeduction = noPayDays * noPayVal;
                } else {
                    noPayDeduction = noPayDays * (baseSalary / 22) * (noPayVal / 100);
                }
            }

            // EPF & ETF (Permanent only)
            let epfEmployee = 0;
            let epfEmployer = 0;
            let etfEmployer = 0;
            if (emp.employment_type === 'permanent') {
                const epfBase = baseSalary + br1Amount + br2Amount;
                epfEmployee = epfBase * (epfEmployeePct / 100);
                epfEmployer = epfBase * (epfEmployerPct / 100);
                etfEmployer = epfBase * (etfEmployerPct / 100);
            }

            // Custom allowances and deductions (e.g. Rent, Meal)
            const empCustomItems = customItemsMap[emp.id] || [];
            const customAdditions = empCustomItems.filter(i => i.type === 'addition').map(i => ({ name: i.name, amount: parseFloat(i.amount) }));
            const customDeductions = empCustomItems.filter(i => i.type === 'deduction').map(i => ({ name: i.name, amount: parseFloat(i.amount) }));

            const customAdditionsSum = customAdditions.reduce((sum, i) => sum + i.amount, 0);
            const customDeductionsSum = customDeductions.reduce((sum, i) => sum + i.amount, 0);

            // Gross salary
            // gross_pay = Basic + BR1 + BR2 + Additional Allowance + Custom Additions + OTs - Late deductions - NoPay
            const additionalAllowance = parseFloat(emp.allowances || 0);
            const grossPay = baseSalary + br1Amount + br2Amount + additionalAllowance + customAdditionsSum + normalOTPay + doubleOTPay - lateDeductionPay - noPayDeduction;

            // PAYE Tax
            let payeTax = 0;
            if (payeTaxEnabled && payeTaxBrackets.length > 0) {
                const sortedBrackets = [...payeTaxBrackets].sort((a, b) => a.min - b.min);
                for (const bracket of sortedBrackets) {
                    const limit = bracket.max - bracket.min;
                    const taxableInBracket = Math.min(Math.max(0, grossPay - bracket.min), limit);
                    if (taxableInBracket > 0) {
                        payeTax += taxableInBracket * (bracket.rate / 100);
                    }
                }
            }

            // Salary Advances
            let advanceDeduction = 0;
            const empAdvances = advancesMap[emp.id] || [];
            for (const adv of empAdvances) {
                advanceDeduction += parseFloat(adv.amount);
            }

            // Active Loans
            let loanDeduction = 0;
            const empLoans = loansMap[emp.id] || [];
            const loansToUpdate = [];
            for (const loan of empLoans) {
                const remaining = parseFloat(loan.remaining_amount);
                const installment = Math.min(parseFloat(loan.monthly_installment), remaining);
                if (installment > 0) {
                    loanDeduction += installment;
                    loansToUpdate.push({
                        id: loan.id,
                        deducted: installment,
                        newRemaining: remaining - installment
                    });
                }
            }

            // Net Pay
            const empFixedDeductionColumn = parseFloat(emp.deductions || 0.00);
            const netPay = Math.max(0, grossPay - epfEmployee - payeTax - advanceDeduction - loanDeduction - customDeductionsSum - empFixedDeductionColumn);

            // 3. Write Payslip to DB
            const [slipResult] = await connection.execute(`
                INSERT INTO payslips (
                    payroll_run_id, employee_id, pay_type, base_salary, hourly_rate, 
                    total_hours_worked, overtime_hours, overtime_pay, allowances, deductions, net_pay, status,
                    br1, br2, normal_ot_hours, normal_ot_pay, double_ot_hours, double_ot_pay,
                    late_hours, late_deduction_pay, no_pay_days, no_pay_deduction,
                    epf_employee, epf_employer, etf_employer, paye_tax,
                    advance_deduction, loan_deduction, custom_additions, custom_deductions, gross_pay
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                runId, emp.id, emp.pay_type || 'monthly', baseSalary, parseFloat(emp.hourly_rate || 0),
                totalHoursWorked, normalOTHours + doubleOTHours, normalOTPay + doubleOTPay,
                additionalAllowance + customAdditionsSum, empFixedDeductionColumn + customDeductionsSum,
                netPay, 'draft',
                br1Amount, br2Amount, normalOTHours, normalOTPay, doubleOTHours, doubleOTPay,
                lateHours, lateDeductionPay, noPayDays, noPayDeduction,
                epfEmployee, epfEmployer, etfEmployer, payeTax,
                advanceDeduction, loanDeduction, JSON.stringify(customAdditions), JSON.stringify(customDeductions), grossPay
            ]);
            const payslipId = slipResult.insertId;

            // 4. Update status of deducted salary advances
            for (const adv of empAdvances) {
                await connection.execute(
                    "UPDATE salary_advances SET status = 'deducted', deducted_payslip_id = ? WHERE id = ?",
                    [payslipId, adv.id]
                );
            }

            // 5. Update outstanding remaining loan balance
            for (const loanUp of loansToUpdate) {
                const loanStatus = loanUp.newRemaining <= 0 ? 'completed' : 'active';
                await connection.execute(
                    "UPDATE employee_loans SET remaining_amount = ?, status = ? WHERE id = ?",
                    [loanUp.newRemaining, loanStatus, loanUp.id]
                );
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            payrollRunId: runId,
            warnings: warnings.slice(0, 50)
        });
    } catch (err) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
        }
        console.error('[payroll/runs POST]', err);
        return NextResponse.json({ error: 'Failed to generate payroll: ' + err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
