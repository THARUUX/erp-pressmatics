import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/services/[id]/sales-orders — list all SOs linked to this service
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // SOs linked via tasks or direct service_id
        const [rows] = await pool.execute(
            `SELECT DISTINCT so.id, so.code, so.customer_name, so.status, so.total_amount, so.delivery_date, so.created_at,
                    COUNT(jt.id) AS task_count
             FROM sales_orders so
             LEFT JOIN job_tasks jt ON jt.sales_order_id = so.id
             WHERE jt.service_id = ? OR so.service_id = ?
             GROUP BY so.id
             ORDER BY so.created_at DESC`,
            [id, id]
        );

        // Also fetch SOs from converted quotations belonging to this service
        const [fromQuotes] = await pool.execute(
            `SELECT DISTINCT so.id, so.code, so.customer_name, so.status, so.total_amount, so.delivery_date, so.created_at,
                    COUNT(jt.id) AS task_count
             FROM sales_orders so
             INNER JOIN quotations q ON so.quotation_id = q.id
             LEFT JOIN job_tasks jt ON jt.sales_order_id = so.id
             WHERE q.service_id = ?
             GROUP BY so.id
             ORDER BY so.created_at DESC`,
            [id]
        );

        // Merge, dedup by id
        const soMap = {};
        [...rows, ...fromQuotes].forEach(r => { soMap[r.id] = r; });
        const salesOrders = Object.values(soMap).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return NextResponse.json({ salesOrders });
    } catch (error) {
        console.error('GET /api/services/[id]/sales-orders error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/services/[id]/sales-orders  body: { soId }
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const { soId } = await req.json();
        if (!soId) return NextResponse.json({ error: 'soId is required' }, { status: 400 });

        // Verify the SO is actually linked to this service
        const [check] = await pool.execute(
            `SELECT so.id, so.quotation_id FROM sales_orders so
             LEFT JOIN job_tasks jt ON jt.sales_order_id = so.id AND jt.service_id = ?
             LEFT JOIN quotations q  ON so.quotation_id = q.id AND q.service_id = ?
             WHERE so.id = ? AND (jt.service_id = ? OR q.service_id = ? OR so.service_id = ?)
             LIMIT 1`,
            [id, id, soId, id, id, id]
        );
        if (check.length === 0) {
            return NextResponse.json({ error: 'Sales order not linked to this service' }, { status: 403 });
        }
        const quotationId = check[0]?.quotation_id;

        // Delete work logs for tasks of this SO
        const [soTasks] = await pool.execute(
            `SELECT id FROM job_tasks WHERE sales_order_id = ?`, [soId]
        );
        const taskIds = soTasks.map(t => t.id);
        if (taskIds.length > 0) {
            await pool.execute(
                `DELETE FROM job_task_work_logs WHERE task_id IN (${taskIds.map(() => '?').join(',')})`,
                taskIds
            );
            await pool.execute(
                `DELETE FROM job_tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`,
                taskIds
            );
        }

        // Delete SO items/stock issues if they exist
        try {
            await pool.execute(`DELETE FROM sales_order_items WHERE sales_order_id = ?`, [soId]);
        } catch { /* optional table */ }
        try {
            await pool.execute(`DELETE FROM sales_order_stock_issues WHERE sales_order_id = ?`, [soId]);
        } catch { /* optional table */ }

        // Delete the sales order itself
        await pool.execute(`DELETE FROM sales_orders WHERE id = ?`, [soId]);

        // Reset linked quotation status back to 'approved' so Convert to Sales Order is available again
        if (quotationId) {
            await pool.execute("UPDATE quotations SET status = 'approved' WHERE id = ?", [quotationId]);
        }

        return NextResponse.json({ success: true, deletedTasks: taskIds.length });
    } catch (error) {
        console.error('DELETE /api/services/[id]/sales-orders error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
