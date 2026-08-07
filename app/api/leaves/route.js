import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/leaves ──────────────────────────────────────────────────────────
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get('employeeId');
        const status = searchParams.get('status');

        let query = `
            SELECT l.*, e.name as employee_name, e.employee_id as erp_code, e.department, e.job_title, e.leave_limit, e.remaining_leaves
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

        const start = new Date(start_date);
        const end = new Date(end_date);
        const diffTime = Math.abs(end - start);
        const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (status === 'approved') {
            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                const [empRows] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ? FOR UPDATE', [employee_id]);
                if (empRows.length === 0) {
                    await conn.rollback();
                    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
                }

                const remaining = empRows[0].remaining_leaves;
                if (remaining < days) {
                    await conn.rollback();
                    return NextResponse.json({ error: `Insufficient leave balance. Remaining: ${remaining} days, Requested: ${days} days.` }, { status: 400 });
                }

                // Deduct remaining leaves
                await conn.execute('UPDATE employees SET remaining_leaves = remaining_leaves - ? WHERE id = ?', [days, employee_id]);

                // Insert leave
                const [result] = await conn.execute(
                    `INSERT INTO leaves (employee_id, start_date, end_date, leave_type, status, reason)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [employee_id, start_date, end_date, leave_type, status, reason || null]
                );

                await conn.commit();
                return NextResponse.json({ success: true, id: result.insertId });
            } catch (txErr) {
                await conn.rollback();
                throw txErr;
            } finally {
                conn.release();
            }
        } else {
            const [result] = await pool.execute(
                `INSERT INTO leaves (employee_id, start_date, end_date, leave_type, status, reason)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [employee_id, start_date, end_date, leave_type, status, reason || null]
            );
            return NextResponse.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('[leaves POST]', err);
        return NextResponse.json({ error: 'Failed to create leave application' }, { status: 500 });
    }
}
