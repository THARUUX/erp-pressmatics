import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * PATCH /api/job-planning/employee/assign
 * Body: { taskId, employeeName, scheduledDate, status }
 * Updates assigned_to (name) and/or scheduled_date on job_tasks.
 */
export async function PATCH(req) {
    try {
        const { taskId, employeeName, scheduledDate, status } = await req.json();
        if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

        const updates = [];
        const params = [];

        if (employeeName !== undefined) {
            updates.push('assigned_to = ?');
            params.push(employeeName || null);
        }
        if (scheduledDate !== undefined) {
            updates.push('scheduled_date = ?');
            params.push(scheduledDate || null);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        updates.push('updated_at = NOW()');
        params.push(taskId);

        if (updates.length <= 1) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

        await pool.execute(`UPDATE job_tasks SET ${updates.join(', ')} WHERE id = ?`, params);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[employee assign PATCH]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
