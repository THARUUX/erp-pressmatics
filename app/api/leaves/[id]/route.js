import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── PUT /api/leaves/[id] ──────────────────────────────────────────────────────
export async function PUT(req, { params }) {
    const conn = await pool.getConnection();
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, start_date, end_date, leave_type, reason } = body;

        await conn.beginTransaction();

        // 1. Fetch the existing leave record
        const [existing] = await conn.execute('SELECT * FROM leaves WHERE id = ? FOR UPDATE', [id]);
        if (existing.length === 0) {
            await conn.rollback();
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }

        const leave = existing[0];
        const employeeId = leave.employee_id;

        // Calculate old days
        const oldStart = new Date(leave.start_date);
        const oldEnd = new Date(leave.end_date);
        const oldDays = Math.round(Math.abs(oldEnd - oldStart) / (1000 * 60 * 60 * 24)) + 1;
        const oldStatus = leave.status;

        // Determine new values
        const newStatus = status !== undefined ? status : oldStatus;
        const newStartDate = start_date !== undefined ? start_date : leave.start_date;
        const newEndDate = end_date !== undefined ? end_date : leave.end_date;

        // Calculate new days
        const newStart = new Date(newStartDate);
        const newEnd = new Date(newEndDate);
        const newDays = Math.round(Math.abs(newEnd - newStart) / (1000 * 60 * 60 * 24)) + 1;

        // Calculate net change in leave balance to deduct
        let netChange = 0;
        if (oldStatus === 'approved' && newStatus === 'approved') {
            netChange = newDays - oldDays;
        } else if (oldStatus !== 'approved' && newStatus === 'approved') {
            netChange = newDays;
        } else if (oldStatus === 'approved' && newStatus !== 'approved') {
            netChange = -oldDays;
        }

        if (netChange !== 0) {
            // Check employee's current balance
            const [empRows] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ? FOR UPDATE', [employeeId]);
            if (empRows.length === 0) {
                await conn.rollback();
                return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
            }

            const remaining = empRows[0].remaining_leaves;
            if (netChange > 0 && remaining < netChange) {
                await conn.rollback();
                return NextResponse.json({ error: `Insufficient leave balance. Remaining: ${remaining} days, Requested additional: ${netChange} days.` }, { status: 400 });
            }

            // Update remaining leaves
            await conn.execute('UPDATE employees SET remaining_leaves = remaining_leaves - ? WHERE id = ?', [netChange, employeeId]);
        }

        // 2. Perform the update
        let query = 'UPDATE leaves SET ';
        let fields = [];
        let paramsList = [];

        if (status !== undefined) {
            fields.push('status = ?');
            paramsList.push(status);
        }
        if (start_date !== undefined) {
            fields.push('start_date = ?');
            paramsList.push(start_date);
        }
        if (end_date !== undefined) {
            fields.push('end_date = ?');
            paramsList.push(end_date);
        }
        if (leave_type !== undefined) {
            fields.push('leave_type = ?');
            paramsList.push(leave_type);
        }
        if (reason !== undefined) {
            fields.push('reason = ?');
            paramsList.push(reason || null);
        }

        query += fields.join(', ') + ' WHERE id = ?';
        paramsList.push(id);

        await conn.execute(query, paramsList);
        await conn.commit();

        return NextResponse.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('[leaves/:id PUT]', err);
        return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
    } finally {
        conn.release();
    }
}

// ── DELETE /api/leaves/[id] ───────────────────────────────────────────────────
export async function DELETE(req, { params }) {
    const conn = await pool.getConnection();
    try {
        const { id } = await params;

        await conn.beginTransaction();

        // 1. Fetch the leave request to see if it was approved
        const [existing] = await conn.execute('SELECT * FROM leaves WHERE id = ? FOR UPDATE', [id]);
        if (existing.length === 0) {
            await conn.rollback();
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }

        const leave = existing[0];
        if (leave.status === 'approved') {
            const start = new Date(leave.start_date);
            const end = new Date(leave.end_date);
            const days = Math.round(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

            // Refund leaves
            await conn.execute('UPDATE employees SET remaining_leaves = remaining_leaves + ? WHERE id = ?', [days, leave.employee_id]);
        }

        // 2. Delete the record
        await conn.execute('DELETE FROM leaves WHERE id = ?', [id]);
        await conn.commit();

        return NextResponse.json({ success: true });
    } catch (err) {
        await conn.rollback();
        console.error('[leaves/:id DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 });
    } finally {
        conn.release();
    }
}
