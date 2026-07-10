import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ─── Helper to resolve code or ID to numeric ID ─────────────────────────────
async function getSalesOrderId(idOrCode) {
    if (!isNaN(idOrCode)) {
        return parseInt(idOrCode);
    }
    const [orders] = await pool.execute('SELECT id FROM sales_orders WHERE code = ?', [idOrCode]);
    return orders[0]?.id || null;
}

// PUT /api/sales-orders/[id]/tasks/reorder
// body: { order: [taskId1, taskId2, ...] }
export async function PUT(req, { params }) {
    try {
        const resolvedParams = await params;
        const rawId = resolvedParams?.id;
        if (!rawId || rawId === 'undefined' || rawId === 'null') {
            return NextResponse.json({ error: 'Invalid or missing Sales Order ID' }, { status: 400 });
        }

        const id = await getSalesOrderId(rawId);
        if (!id) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const { order } = await req.json();

        if (!Array.isArray(order)) {
            return NextResponse.json({ error: 'order must be an array of task IDs' }, { status: 400 });
        }

        for (let i = 0; i < order.length; i++) {
            await pool.execute(
                'UPDATE job_tasks SET display_order = ? WHERE id = ? AND sales_order_id = ?',
                [i, order[i], id]
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

