import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// PUT /api/machines/[id]/reorder
// Body: { taskIds: [id1, id2, id3, ...] } — ordered list of task IDs for this machine's queue
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const { taskIds } = await req.json();

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return NextResponse.json({ error: 'taskIds array required' }, { status: 400 });
        }

        // Update machine_position for each task in the new order
        for (let i = 0; i < taskIds.length; i++) {
            await pool.execute(
                'UPDATE job_tasks SET machine_position = ? WHERE id = ? AND machine_id = ?',
                [i + 1, taskIds[i], id]
            );
        }

        return NextResponse.json({ ok: true, count: taskIds.length });
    } catch (err) {
        console.error('Reorder error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
