import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/leaves ──────────────────────────────────────────────────────────
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');
        const status = searchParams.get('status');

        let query = `
            SELECT l.*, e.name as employee_name, e.employee_id as erp_code, e.department, e.job_title
            FROM leaves l
            JOIN employees e ON l.employee_id = e.id
        `;
        let params = [];
        let where = [];

        if (employeeId) {
            where.push('l.employee_id = ?');
            params.push(employeeId);
        }
        if (status) {
            where.push('l.status = ?');
            params.push(status);
        }

        if (where.length > 0) {
            query += ' WHERE ' + where.join(' AND ');
        }

        query += ' ORDER BY l.start_date DESC';
        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[leaves GET]', err);
        return NextResponse.json({ error: 'Failed to fetch leaves' }, { status: 500 });
    }
}

// ── POST /api/leaves ─────────────────────────────────────────────────────────
export async function POST(req) {
    try {
        const body = await req.json();
        const { employee_id, start_date, end_date, leave_type, status = 'approved', reason } = body;

        if (!employee_id || !start_date || !end_date || !leave_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const [result] = await pool.execute(
            `INSERT INTO leaves (employee_id, start_date, end_date, leave_type, status, reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [employee_id, start_date, end_date, leave_type, status, reason || null]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('[leaves POST]', err);
        return NextResponse.json({ error: 'Failed to create leave application' }, { status: 500 });
    }
}
