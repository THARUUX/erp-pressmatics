import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * PUT /api/employees/bulk-update
 * Body: { rows: [{id, employee_id, name, job_title, department, phone, email, date_of_birth, date_joined, shift, status, notes, pay_type, base_salary, hourly_rate, allowances, deductions, ot_rate_multiplier, standard_working_hours}] }
 * Returns: { updated: N, skipped: [{id, reason}], failed: [{id, error}] }
 */
export async function PUT(req) {
    try {
        const { rows } = await req.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
        }

        const updated = [];
        const skipped = [];
        const failed  = [];

        for (const row of rows) {
            const id = parseInt(row.id);
            if (!id || isNaN(id)) {
                skipped.push({ id: row.id, reason: 'Missing or invalid id' });
                continue;
            }
            if (!row.name?.trim()) {
                skipped.push({ id, reason: 'Name is required' });
                continue;
            }
            try {
                const dob = row.date_of_birth ? row.date_of_birth.slice(0, 10) : null;
                const joined = row.date_joined ? row.date_joined.slice(0, 10) : null;
                const baseSalary = parseFloat(row.base_salary) || 0;
                const hourlyRate = parseFloat(row.hourly_rate) || 0;
                const allowances = parseFloat(row.allowances) || 0;
                const deductions = parseFloat(row.deductions) || 0;
                const otMultiplier = parseFloat(row.ot_rate_multiplier) || 1.5;
                const workingHours = parseFloat(row.standard_working_hours) || 8;

                const employmentType = row.employment_type || 'permanent';
                const workingDays = row.working_days || 'Monday,Tuesday,Wednesday,Thursday,Friday';
                const noPayType = row.no_pay_type || 'percentage';
                const noPayValue = parseFloat(row.no_pay_value) || 0;
                const otRate = parseFloat(row.ot_rate) || 0;
                const doubleOtRate = parseFloat(row.double_ot_rate) || 0;
                const lateDeductionRate = parseFloat(row.late_deduction_rate) || 0;

                const [result] = await pool.execute(
                    `UPDATE employees SET
                        employee_id=?, name=?, job_title=?, department=?, phone=?, email=?,
                        date_of_birth=?, date_joined=?, shift=?, status=?, notes=?,
                        pay_type=?, base_salary=?, hourly_rate=?, allowances=?, deductions=?,
                        ot_rate_multiplier=?, standard_working_hours=?,
                        employment_type=?, working_days=?, no_pay_type=?, no_pay_value=?,
                        ot_rate=?, double_ot_rate=?, late_deduction_rate=?
                     WHERE id=?`,
                    [
                        row.employee_id?.trim() || null,
                        row.name.trim(),
                        row.job_title?.trim() || null,
                        row.department?.trim() || null,
                        row.phone?.trim() || null,
                        row.email?.trim() || null,
                        dob,
                        joined,
                        row.shift || 'Day',
                        row.status || 'active',
                        row.notes || null,
                        row.pay_type || 'monthly',
                        baseSalary,
                        hourlyRate,
                        allowances,
                        deductions,
                        otMultiplier,
                        workingHours,
                        employmentType,
                        workingDays,
                        noPayType,
                        noPayValue,
                        otRate,
                        doubleOtRate,
                        lateDeductionRate,
                        id
                    ]
                );
                if (result.affectedRows > 0) updated.push(id);
                else skipped.push({ id, reason: 'Employee not found' });
            } catch (err) {
                failed.push({ id, error: err.message });
            }
        }

        return NextResponse.json({ updated: updated.length, skipped, failed });
    } catch (error) {
        console.error('Bulk update employees error:', error);
        return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
    }
}
