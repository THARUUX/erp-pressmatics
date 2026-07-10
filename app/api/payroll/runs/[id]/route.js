import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/payroll/runs/[id] ────────────────────────────────────────────────
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // 1. Fetch the payroll run metadata
        const [[run]] = await pool.execute(
            'SELECT * FROM payroll_runs WHERE id = ?',
            [id]
        );

        if (!run) {
            return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
        }

        // 2. Fetch all payslips for this run joined with employee details
        const [payslips] = await pool.execute(`
            SELECT p.*, 
                   e.name as employee_name, 
                   e.employee_id as erp_code, 
                   e.job_title, 
                   e.department
            FROM payslips p
            JOIN employees e ON p.employee_id = e.id
            WHERE p.payroll_run_id = ?
            ORDER BY e.name ASC
        `, [id]);

        return NextResponse.json({ run, payslips });
    } catch (err) {
        console.error('[payroll/runs/:id GET]', err);
        return NextResponse.json({ error: 'Failed to fetch payroll run details' }, { status: 500 });
    }
}

// ── PUT /api/payroll/runs/[id] ────────────────────────────────────────────────
export async function PUT(req, { params }) {
    let connection;
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, payslipUpdates } = body;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if run exists
        const [[run]] = await connection.execute(
            'SELECT id FROM payroll_runs WHERE id = ?',
            [id]
        );

        if (!run) {
            return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
        }

        // Action A: Update overall run status (e.g., mark as 'paid')
        if (status) {
            await connection.execute(
                'UPDATE payroll_runs SET status = ? WHERE id = ?',
                [status, id]
            );
            await connection.execute(
                'UPDATE payslips SET status = ? WHERE payroll_run_id = ?',
                [status, id]
            );
        }

        // Action B: Override specific payslip adjustments (allowances/deductions)
        if (payslipUpdates && Array.isArray(payslipUpdates)) {
            for (const update of payslipUpdates) {
                const { id: payslipId, allowances, deductions } = update;
                if (!payslipId) continue;

                // Fetch current payslip to recalculate net pay correctly
                const [[current]] = await connection.execute(
                    'SELECT pay_type, base_salary, hourly_rate, total_hours_worked, overtime_pay FROM payslips WHERE id = ?',
                    [payslipId]
                );

                if (!current) continue;

                const baseSalary = parseFloat(current.base_salary);
                const hourlyRate = parseFloat(current.hourly_rate);
                const totalHours = parseFloat(current.total_hours_worked);
                const otPay = parseFloat(current.overtime_pay);

                const newAllowances = allowances !== undefined ? parseFloat(allowances) : 0;
                const newDeductions = deductions !== undefined ? parseFloat(deductions) : 0;

                // Re-calculate pay components
                let regularPay = 0;
                if (current.pay_type === 'hourly') {
                    // Estimate regular pay
                    regularPay = baseSalary || (totalHours * hourlyRate); // Fallback to hours * rate
                } else {
                    regularPay = baseSalary;
                }

                const netPay = Math.max(0, (regularPay + otPay + newAllowances) - newDeductions);

                await connection.execute(
                    `UPDATE payslips 
                     SET allowances = ?, deductions = ?, net_pay = ? 
                     WHERE id = ?`,
                    [newAllowances, newDeductions, netPay, payslipId]
                );
            }
        }

        await connection.commit();
        return NextResponse.json({ success: true, message: 'Payroll run updated successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('[payroll/runs/:id PUT]', err);
        return NextResponse.json({ error: 'Failed to update payroll run: ' + err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ── DELETE /api/payroll/runs/[id] ─────────────────────────────────────────────
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;

        const [result] = await pool.execute(
            'DELETE FROM payroll_runs WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Payroll run deleted successfully' });
    } catch (err) {
        console.error('[payroll/runs/:id DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete payroll run' }, { status: 500 });
    }
}
