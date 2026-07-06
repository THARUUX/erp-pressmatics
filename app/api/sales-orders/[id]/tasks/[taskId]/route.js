import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Convert ISO 8601 string → MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
function toMySQL(isoStr) {
    if (!isoStr) return null;
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().slice(0, 19).replace('T', ' ');
    } catch {
        return null;
    }
}

export async function PUT(req, { params }) {
    try {
        const { id, taskId } = await params;
        const body = await req.json();
        const { name, status, completed_at, completed_by, assigned_to, description, machine_id, machine_name, estimated_minutes } = body;

        const hasMachineUpdate = Object.prototype.hasOwnProperty.call(body, 'machine_id');

        // Fetch current task to detect in_progress transition
        const [current] = await pool.execute('SELECT status, started_at FROM job_tasks WHERE id = ?', [taskId]);
        const prevStatus = current[0]?.status;
        const alreadyStarted = current[0]?.started_at;
        // Record started_at when moving to in_progress for the first time
        const setStartedAt = status === 'in_progress' && prevStatus !== 'in_progress' && !alreadyStarted;

        const updates = [];
        const paramsList = [];

        if (name !== undefined) {
            updates.push('name = ?');
            paramsList.push(name || null);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            paramsList.push(status || null);
        }
        if (completed_at !== undefined) {
            updates.push('completed_at = ?');
            paramsList.push(toMySQL(completed_at));
        }
        if (setStartedAt) {
            updates.push('started_at = NOW()');
        }
        if (completed_by !== undefined) {
            updates.push('completed_by = ?');
            paramsList.push(completed_by || null);
        }
        if (assigned_to !== undefined) {
            updates.push('assigned_to = ?');
            paramsList.push(assigned_to || null);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            paramsList.push(description || null);
        }
        if (estimated_minutes !== undefined) {
            updates.push('estimated_minutes = ?');
            paramsList.push(estimated_minutes !== null ? parseInt(estimated_minutes) : null);
        }
        if (hasMachineUpdate) {
            updates.push('machine_id = ?');
            paramsList.push(machine_id ?? null);
            updates.push('machine_name = ?');
            paramsList.push(machine_name || null);
        }
        updates.push('updated_at = NOW()');

        paramsList.push(taskId, id);

        await pool.execute(
            `UPDATE job_tasks
             SET ${updates.join(', ')}
             WHERE id = ? AND sales_order_id = ?`,
            paramsList
        );

        const [task] = await pool.execute('SELECT * FROM job_tasks WHERE id = ?', [taskId]);
        if (!task[0]) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        return NextResponse.json(task[0]);
    } catch (err) {
        console.error('Task PUT error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id, taskId } = await params;
        await pool.execute('DELETE FROM job_tasks WHERE id = ? AND sales_order_id = ?', [taskId, id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
