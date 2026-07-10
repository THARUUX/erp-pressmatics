import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/employees ────────────────────────────────────────────────────────
export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT e.*,
                   COUNT(DISTINCT tm.team_id) AS team_count,
                   GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ', ') AS team_names
            FROM employees e
            LEFT JOIN team_members tm ON tm.employee_id = e.id
            LEFT JOIN teams t ON t.id = tm.team_id
            GROUP BY e.id
            ORDER BY e.name ASC
        `);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[employees GET]', err);
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }
}

// ── POST /api/employees ───────────────────────────────────────────────────────
export async function POST(req) {
    try {
        const body = await req.json();
        const {
            name, job_title, department, phone, email,
            date_of_birth, date_joined, shift = 'Day',
            status = 'active', notes,
            pay_type = 'monthly', base_salary = 0, hourly_rate = 0,
            allowances = 0, deductions = 0, ot_rate_multiplier = 1.5,
            standard_working_hours = 8
        } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Auto-generate employee_id: EMP-001, EMP-002 …
        const [[{ maxId }]] = await pool.execute(
            `SELECT COALESCE(MAX(id), 0) AS maxId FROM employees`
        );
        const employeeId = `EMP-${String(maxId + 1).padStart(3, '0')}`;

        const [result] = await pool.execute(
            `INSERT INTO employees
             (employee_id, name, job_title, department, phone, email,
              date_of_birth, date_joined, shift, status, notes,
              pay_type, base_salary, hourly_rate, allowances, deductions,
              ot_rate_multiplier, standard_working_hours)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employeeId,
                name.trim(),
                job_title  || null,
                department || null,
                phone      || null,
                email      || null,
                date_of_birth || null,
                date_joined   || null,
                shift,
                status,
                notes || null,
                pay_type,
                base_salary,
                hourly_rate,
                allowances,
                deductions,
                ot_rate_multiplier,
                standard_working_hours
            ]
        );

        return NextResponse.json({ success: true, id: result.insertId, employee_id: employeeId });
    } catch (err) {
        console.error('[employees POST]', err);
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }
}
