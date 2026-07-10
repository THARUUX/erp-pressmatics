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
            ot_rate_multiplier, standard_working_hours
        } = await req.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        await pool.execute(
            `UPDATE employees SET
               name=?, job_title=?, department=?, phone=?, email=?,
               date_of_birth=?, date_joined=?, shift=?, status=?, notes=?,
               pay_type=?, base_salary=?, hourly_rate=?, allowances=?, deductions=?,
               ot_rate_multiplier=?, standard_working_hours=?
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
