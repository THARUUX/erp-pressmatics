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
        const { name, status, completed_at, completed_by, assigned_to, description, machine_id, machine_name } = body;

        const hasMachineUpdate = Object.prototype.hasOwnProperty.call(body, 'machine_id');

        // Fetch current task to detect in_progress transition
        const [current] = await pool.execute('SELECT status, started_at FROM job_tasks WHERE id = ?', [taskId]);
        const prevStatus = current[0]?.status;
        const alreadyStarted = current[0]?.started_at;
        // Record started_at when moving to in_progress for the first time
        const setStartedAt = status === 'in_progress' && prevStatus !== 'in_progress' && !alreadyStarted;

        await pool.execute(
            `UPDATE job_tasks
             SET name         = COALESCE(?, name),
                 status       = COALESCE(?, status),
                 completed_at = ?,
                 ${ setStartedAt ? 'started_at = NOW(),' : '' }
                 completed_by = COALESCE(?, completed_by),
                 assigned_to  = COALESCE(?, assigned_to),
                 description  = COALESCE(?, description),
                 machine_id   = ${hasMachineUpdate ? '?' : 'machine_id'},
                 machine_name = ${hasMachineUpdate ? '?' : 'machine_name'},
                 updated_at   = NOW()
             WHERE id = ? AND sales_order_id = ?`,
            hasMachineUpdate
                ? [name || null, status || null, toMySQL(completed_at), completed_by || null, assigned_to || null, description || null, machine_id ?? null, machine_name || null, taskId, id]
                : [name || null, status || null, toMySQL(completed_at), completed_by || null, assigned_to || null, description || null, taskId, id]
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
