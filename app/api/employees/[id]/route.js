import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/employees/[id] ───────────────────────────────────────────────────
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [[employee]] = await pool.execute(
            `SELECT * FROM employees WHERE id = ?`, [id]
        );
        if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const [teams] = await pool.execute(`
            SELECT t.id, t.name, t.color, tm.role
            FROM team_members tm
            JOIN teams t ON t.id = tm.team_id
            WHERE tm.employee_id = ?
        `, [id]);

        return NextResponse.json({ ...employee, teams });
    } catch (err) {
        console.error('[employees/:id GET]', err);
        return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
    }
}

// ── PUT /api/employees/[id] ───────────────────────────────────────────────────
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const {
            name, job_title, department, phone, email,
            date_of_birth, date_joined, shift, status, notes,
            pay_type, base_salary, hourly_rate, allowances, deductions,
            ot_rate_multiplier, standard_working_hours,
            employment_type, working_days, no_pay_type, no_pay_value,
            ot_rate, double_ot_rate, late_deduction_rate,
            leave_limit, remaining_leaves
        } = await req.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Fetch current values to preserve leave values if not specified
        const [[curEmp]] = await pool.execute('SELECT leave_limit, remaining_leaves FROM employees WHERE id = ?', [id]);
        const finalLeaveLimit = leave_limit !== undefined ? leave_limit : (curEmp ? curEmp.leave_limit : 21);
        const finalRemainingLeaves = remaining_leaves !== undefined ? remaining_leaves : (curEmp ? curEmp.remaining_leaves : 21);

        await pool.execute(
            `UPDATE employees SET
               name=?, job_title=?, department=?, phone=?, email=?,
               date_of_birth=?, date_joined=?, shift=?, status=?, notes=?,
               pay_type=?, base_salary=?, hourly_rate=?, allowances=?, deductions=?,
               ot_rate_multiplier=?, standard_working_hours=?,
               employment_type=?, working_days=?, no_pay_type=?, no_pay_value=?,
               ot_rate=?, double_ot_rate=?, late_deduction_rate=?,
               leave_limit=?, remaining_leaves=?
             WHERE id=?`,
            [
                name.trim(),
                job_title  || null,
                department || null,
                phone      || null,
                email      || null,
                date_of_birth || null,
                date_joined   || null,
                shift  || 'Day',
                status || 'active',
                notes  || null,
                pay_type || 'monthly',
                base_salary || 0,
                hourly_rate || 0,
                allowances || 0,
                deductions || 0,
                ot_rate_multiplier || 1.5,
                standard_working_hours || 8,
                employment_type || 'permanent',
                working_days || 'Monday,Tuesday,Wednesday,Thursday,Friday',
                no_pay_type || 'percentage',
                no_pay_value || 0,
                ot_rate || 0,
                double_ot_rate || 0,
                late_deduction_rate || 0,
                finalLeaveLimit,
                finalRemainingLeaves,
                id
            ]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[employees/:id PUT]', err);
        return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
    }
}

// ── DELETE /api/employees/[id] ────────────────────────────────────────────────
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        // team_members cascade via FK; also clear machine assignments
        await pool.execute(`UPDATE machines SET assigned_employee_id = NULL WHERE assigned_employee_id = ?`, [id]);
        await pool.execute(`DELETE FROM employees WHERE id = ?`, [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[employees/:id DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
    }
}
