import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/employees/bulk
 * Body: { employees: [{name, employee_id, job_title, department, phone, email, date_of_birth, date_joined, shift, status, notes, pay_type, base_salary, hourly_rate, allowances, deductions, ot_rate_multiplier, standard_working_hours}] }
 * Returns: { imported: N, failed: [{row, error}] }
 */
export async function POST(req) {
    try {
        const { employees } = await req.json();
        if (!Array.isArray(employees) || employees.length === 0) {
            return NextResponse.json({ error: 'No employees provided' }, { status: 400 });
        }

        const [[{ maxId }]] = await pool.execute(
            `SELECT COALESCE(MAX(id), 0) AS maxId FROM employees`
        );
        let nextId = maxId + 1;

        const imported = [];
        const failed   = [];

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const name = (emp.name || '').trim();
            if (!name) {
                failed.push({ row: i + 2, error: 'Name is required' });
                continue;
            }

            let employeeId = (emp.employee_id || '').trim();
            if (!employeeId) {
                employeeId = `EMP-${String(nextId).padStart(3, '0')}`;
                nextId++;
            }

            try {
                const dob = emp.date_of_birth ? emp.date_of_birth.slice(0, 10) : null;
                const joined = emp.date_joined ? emp.date_joined.slice(0, 10) : null;
                const baseSalary = parseFloat(emp.base_salary) || 0;
                const hourlyRate = parseFloat(emp.hourly_rate) || 0;
                const allowances = parseFloat(emp.allowances) || 0;
                const deductions = parseFloat(emp.deductions) || 0;
                const otMultiplier = parseFloat(emp.ot_rate_multiplier) || 1.5;
                const workingHours = parseFloat(emp.standard_working_hours) || 8;

                await pool.execute(
                    `INSERT INTO employees
                     (employee_id, name, job_title, department, phone, email,
                      date_of_birth, date_joined, shift, status, notes,
                      pay_type, base_salary, hourly_rate, allowances, deductions,
                      ot_rate_multiplier, standard_working_hours)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        employeeId,
                        name,
                        emp.job_title || null,
                        emp.department || null,
                        emp.phone || null,
                        emp.email || null,
                        dob,
                        joined,
                        emp.shift || 'Day',
                        emp.status || 'active',
                        emp.notes || null,
                        emp.pay_type || 'monthly',
                        baseSalary,
                        hourlyRate,
                        allowances,
                        deductions,
                        otMultiplier,
                        workingHours
                    ]
                );
                imported.push(name);
            } catch (err) {
                failed.push({ row: i + 2, error: err.message });
            }
        }

        return NextResponse.json({ imported: imported.length, failed });
    } catch (error) {
        console.error('Bulk employees import error:', error);
        return NextResponse.json({ error: 'Bulk import failed' }, { status: 500 });
    }
}

/**
 * DELETE /api/employees/bulk
 * Body: { ids: [id1, id2, ...] }
 * Returns: { deleted: N, failed: [{id, error}] }
 */
export async function DELETE(req) {
    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const deleted = [];
        const failed = [];

        for (const id of ids) {
            try {
                // Delete references if there are any, e.g. from team_members
                await pool.execute('DELETE FROM team_members WHERE employee_id = ?', [id]);

                const [result] = await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
                if (result.affectedRows > 0) {
                    deleted.push(id);
                } else {
                    failed.push({ id, error: 'Employee not found' });
                }
            } catch (err) {
                failed.push({ id, error: err.message });
            }
        }

        return NextResponse.json({ deleted: deleted.length, failed });
    } catch (error) {
        console.error('Bulk employee delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
