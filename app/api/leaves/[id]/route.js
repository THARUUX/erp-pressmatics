import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── PUT /api/leaves/[id] ──────────────────────────────────────────────────────
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, start_date, end_date, leave_type, reason } = body;

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

        if (fields.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        query += fields.join(', ') + ' WHERE id = ?';
        paramsList.push(id);

        const [result] = await pool.execute(query, paramsList);

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[leaves/:id PUT]', err);
        return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
    }
}

// ── DELETE /api/leaves/[id] ───────────────────────────────────────────────────
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const [result] = await pool.execute('DELETE FROM leaves WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[leaves/:id DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 });
    }
}
