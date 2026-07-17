import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/payroll/advances ────────────────────────────────────────────────
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');

        let query = `
            SELECT a.*, e.name as employee_name, e.employee_id as erp_code, e.department, e.job_title
            FROM salary_advances a
            JOIN employees e ON a.employee_id = e.id
        `;
        let params = [];

        if (employeeId) {
            query += ' WHERE a.employee_id = ?';
            params.push(employeeId);
        }

        query += ' ORDER BY a.request_date DESC';
        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[advances GET]', err);
        return NextResponse.json({ error: 'Failed to fetch advances' }, { status: 500 });
    }
}

// ── POST /api/payroll/advances ───────────────────────────────────────────────
export async function POST(req) {
    try {
        const body = await req.json();
        const { employee_id, amount, request_date, status = 'approved' } = body;

        if (!employee_id || amount === undefined || !request_date) {
            return NextResponse.json({ error: 'Missing employee_id, amount, or request_date' }, { status: 400 });
        }

        const [result] = await pool.execute(
            `INSERT INTO salary_advances (employee_id, amount, request_date, status)
             VALUES (?, ?, ?, ?)`,
            [employee_id, amount, request_date, status]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('[advances POST]', err);
        return NextResponse.json({ error: 'Failed to create advance request' }, { status: 500 });
    }
}

// ── DELETE /api/payroll/advances ─────────────────────────────────────────────
export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing advance ID' }, { status: 400 });
        }

        await pool.execute('DELETE FROM salary_advances WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[advances DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete advance record' }, { status: 500 });
    }
}
