import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/attendance ───────────────────────────────────────────────────────
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';
        const state = searchParams.get('state') || ''; // '0' or '1'
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = (page - 1) * limit;

        let queryParams = [];
        let countParams = [];
        let whereClauses = [];

        // Allow states 0, 1, 4, 5 (Check In, Check Out, Break Out, Break In)
        whereClauses.push('l.state IN (0, 1, 4, 5)');

        if (search) {
            whereClauses.push('(e.name LIKE ? OR e.employee_id LIKE ? OR l.device_user_id LIKE ?)');
            const searchVal = `%${search}%`;
            queryParams.push(searchVal, searchVal, searchVal);
            countParams.push(searchVal, searchVal, searchVal);
        }

        if (startDate) {
            whereClauses.push('l.timestamp >= ?');
            queryParams.push(startDate + ' 00:00:00');
            countParams.push(startDate + ' 00:00:00');
        }

        if (endDate) {
            whereClauses.push('l.timestamp <= ?');
            queryParams.push(endDate + ' 23:59:59');
            countParams.push(endDate + ' 23:59:59');
        }

        if (state !== '') {
            whereClauses.push('l.state = ?');
            const stateInt = parseInt(state, 10);
            queryParams.push(stateInt);
            countParams.push(stateInt);
        }

        const whereClauseStr = 'WHERE ' + whereClauses.join(' AND ');

        // 1. Get total logs count matching filters
        const countQuery = `
            SELECT COUNT(*) as count 
            FROM zkteco_attendance_logs l
            LEFT JOIN employee_zkteco_mapping m ON l.device_user_id = m.device_user_id
            LEFT JOIN employees e ON m.employee_id = e.id
            ${whereClauseStr}
        `;
        const [[{ count }]] = await pool.execute(countQuery, countParams);

        // 2. Get paginated logs matching filters
        const logsQuery = `
            SELECT l.id, l.device_user_id, l.timestamp, l.state, l.verification_type,
                   e.name as employee_name, e.employee_id as erp_code, e.department, e.job_title
            FROM zkteco_attendance_logs l
            LEFT JOIN employee_zkteco_mapping m ON l.device_user_id = m.device_user_id
            LEFT JOIN employees e ON m.employee_id = e.id
            ${whereClauseStr}
            ORDER BY l.timestamp DESC
            LIMIT ${limit} OFFSET ${offset}
        `;
        const [rows] = await pool.execute(logsQuery, queryParams);

        return NextResponse.json({
            data: rows,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (err) {
        console.error('[attendance GET]', err);
        return NextResponse.json({ error: 'Failed to fetch attendance logs' }, { status: 500 });
    }
}

// ── POST /api/attendance ──────────────────────────────────────────────────────
export async function POST(req) {
    try {
        const body = await req.json();
        const { employee_id, timestamp, state } = body;

        if (!employee_id || !timestamp || state === undefined) {
            return NextResponse.json({ error: 'Missing employee_id, timestamp, or state' }, { status: 400 });
        }

        // Find device_user_id for this employee
        const [[mapping]] = await pool.execute(
            'SELECT device_user_id FROM employee_zkteco_mapping WHERE employee_id = ?',
            [employee_id]
        );

        if (!mapping) {
            return NextResponse.json({ 
                error: 'This employee has no ZKTeco device mapping configured. Please map the employee under the ZKTeco portal first.' 
            }, { status: 400 });
        }

        const deviceUserId = mapping.device_user_id;

        // Insert into zkteco_attendance_logs
        // verification_type = 9 indicates manual adjustment
        await pool.execute(
            `INSERT INTO zkteco_attendance_logs (device_user_id, timestamp, state, verification_type)
             VALUES (?, ?, ?, 9)
             ON DUPLICATE KEY UPDATE state = VALUES(state), verification_type = 9`,
            [deviceUserId, timestamp, state]
        );

        return NextResponse.json({ success: true, message: 'Log record inserted successfully' });
    } catch (err) {
        console.error('[attendance POST]', err);
        return NextResponse.json({ error: 'Failed to insert log record: ' + err.message }, { status: 500 });
    }
}
