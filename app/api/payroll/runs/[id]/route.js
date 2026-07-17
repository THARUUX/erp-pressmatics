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
                    `SELECT base_salary, br1, br2, overtime_pay, late_deduction_pay, no_pay_deduction, 
                            epf_employee, paye_tax, advance_deduction, loan_deduction 
                     FROM payslips WHERE id = ?`,
                    [payslipId]
                );

                if (!current) continue;

                const baseSalary = parseFloat(current.base_salary || 0);
                const br1 = parseFloat(current.br1 || 0);
                const br2 = parseFloat(current.br2 || 0);
                const otPay = parseFloat(current.overtime_pay || 0);
                const lateDeductionPay = parseFloat(current.late_deduction_pay || 0);
                const noPayDeduction = parseFloat(current.no_pay_deduction || 0);
                
                const epfEmployee = parseFloat(current.epf_employee || 0);
                const payeTax = parseFloat(current.paye_tax || 0);
                const advanceDeduction = parseFloat(current.advance_deduction || 0);
                const loanDeduction = parseFloat(current.loan_deduction || 0);

                const newAllowances = allowances !== undefined ? parseFloat(allowances) : 0;
                const newDeductions = deductions !== undefined ? parseFloat(deductions) : 0;

                // Re-calculate gross and net pay components
                const grossPay = baseSalary + br1 + br2 + newAllowances + otPay - lateDeductionPay - noPayDeduction;
                const netPay = Math.max(0, grossPay - epfEmployee - payeTax - advanceDeduction - loanDeduction - newDeductions);

                await connection.execute(
                    `UPDATE payslips 
                     SET allowances = ?, deductions = ?, gross_pay = ?, net_pay = ? 
                     WHERE id = ?`,
                    [newAllowances, newDeductions, grossPay, netPay, payslipId]
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
