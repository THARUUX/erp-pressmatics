import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/payroll/loans ───────────────────────────────────────────────────
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');

        let query = `
            SELECT l.*, e.name as employee_name, e.employee_id as erp_code, e.department, e.job_title
            FROM employee_loans l
            JOIN employees e ON l.employee_id = e.id
        `;
        let params = [];

        if (employeeId) {
            query += ' WHERE l.employee_id = ?';
            params.push(employeeId);
        }

        query += ' ORDER BY l.created_at DESC';
        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[loans GET]', err);
        return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
    }
}

// ── POST /api/payroll/loans ──────────────────────────────────────────────────
export async function POST(req) {
    try {
        const body = await req.json();
        const { employee_id, loan_amount, monthly_installment } = body;

        if (!employee_id || loan_amount === undefined || monthly_installment === undefined) {
            return NextResponse.json({ error: 'Missing employee_id, loan_amount, or monthly_installment' }, { status: 400 });
        }

        const [result] = await pool.execute(
            `INSERT INTO employee_loans (employee_id, loan_amount, monthly_installment, remaining_amount, status)
             VALUES (?, ?, ?, ?, ?)`,
            [employee_id, loan_amount, monthly_installment, loan_amount, 'active']
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('[loans POST]', err);
        return NextResponse.json({ error: 'Failed to create loan record' }, { status: 500 });
    }
}

// ── DELETE /api/payroll/loans ─────────────────────────────────────────────────
export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing loan ID' }, { status: 400 });
        }

        await pool.execute('DELETE FROM employee_loans WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[loans DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete loan record' }, { status: 500 });
    }
}
