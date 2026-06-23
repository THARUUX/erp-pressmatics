import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// PUT /api/sales-orders/[id]/tasks/reorder
// body: { order: [taskId1, taskId2, ...] }
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const { order } = await req.json();

        if (!Array.isArray(order)) {
            return NextResponse.json({ error: 'order must be an array of task IDs' }, { status: 400 });
        }

        for (let i = 0; i < order.length; i++) {
            await pool.execute(
                'UPDATE job_tasks SET display_order = ? WHERE id = ? AND sales_order_id = ?',
                [i, order[i], parseInt(id)]
            );
        }

        const [tasks] = await pool.execute(
            'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC',
            [id]
        );
        return NextResponse.json(tasks);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
