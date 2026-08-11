import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/services/[id]/sales-orders — list all SOs linked to this service
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // SOs linked via tasks, direct service_id, or converted quotations for this service
        const [salesOrders] = await pool.execute(
            `SELECT DISTINCT so.id, so.code, so.customer_name, so.status, so.total_amount, so.delivery_date, so.created_at,
                    COUNT(jt.id) AS task_count
             FROM sales_orders so
             LEFT JOIN job_tasks jt ON jt.sales_order_id = so.id
             LEFT JOIN quotations q ON so.quotation_id = q.id
             WHERE jt.service_id = ? OR so.service_id = ? OR q.service_id = ?
             GROUP BY so.id
             ORDER BY so.created_at DESC`,
            [id, id, id]
        );

        return NextResponse.json({ salesOrders });
    } catch (error) {
        console.error('GET /api/services/[id]/sales-orders error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/services/[id]/sales-orders — Create a direct / sample sales order with tasks (without a quotation)
export async function POST(req, { params }) {
    const conn = await pool.getConnection();
    try {
        const { id: serviceId } = await params;
        const body = await req.json();
        const {
            customer_name,
            customer_id = null,
            delivery_date = null,
            total_amount = 0,
            job_notes = '',
            tasks = []
        } = body;

        const resolvedCustomerName = customer_name?.trim() || 'Sample Customer';

        // Begin transaction
        await conn.beginTransaction();

        // 1. Generate SO Code
        const [settings] = await conn.execute(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('so_id_template', 'so_id_seq')"
        );
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
        let seq = parseInt(settingsMap['so_id_seq'] || '1');
        let template = settingsMap['so_id_template'] || 'SO-{0000}';
        const code = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // 2. Insert into sales_orders (no quotation_id required)
        const [result] = await conn.execute(
            `INSERT INTO sales_orders (code, quotation_id, customer_id, customer_name, order_date, delivery_date, status, total_amount, job_notes, service_id) 
             VALUES (?, NULL, ?, ?, NOW(), ?, 'Pending', ?, ?, ?)`,
            [
                code,
                customer_id || null,
                resolvedCustomerName,
                delivery_date || null,
                parseFloat(total_amount) || 0,
                job_notes || 'Direct Sample Sales Order',
                serviceId
            ]
        );

        const soId = result.insertId;

        // Update sequence number in settings
        await conn.execute(
            "INSERT INTO settings (setting_key, setting_value) VALUES ('so_id_seq', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [String(seq + 1), String(seq + 1)]
        );

        // 3. Get service name for task title prefix
        let serviceName = 'Service';
        const [srv] = await conn.execute('SELECT name FROM services WHERE id = ?', [serviceId]);
        if (srv.length > 0) serviceName = srv[0].name;

        // 4. Create tasks directly in job_tasks table
        if (Array.isArray(tasks) && tasks.length > 0) {
            for (let idx = 0; idx < tasks.length; idx++) {
                const t = tasks[idx];
                const rawName = t.name?.trim() || `Task ${idx + 1}`;
                const taskName = rawName.startsWith('Service:') ? rawName : `Service: ${serviceName} — ${rawName}`;
                const estMins = t.estimated_minutes ? parseInt(t.estimated_minutes) : null;
                const qty = t.quantity ? parseFloat(t.quantity) : 1;

                await conn.execute(
                    `INSERT INTO job_tasks (sales_order_id, service_id, customer_name, name, description, status, assigned_to, estimated_minutes, quantity, display_order, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        soId,
                        serviceId,
                        resolvedCustomerName,
                        taskName,
                        t.description || null,
                        t.assigned_to || null,
                        estMins,
                        qty,
                        idx + 1
                    ]
                );
            }
        } else {
            // Default task if none specified
            const taskName = `Service: ${serviceName} — Sample Task`;
            await conn.execute(
                `INSERT INTO job_tasks (sales_order_id, service_id, customer_name, name, description, status, assigned_to, estimated_minutes, quantity, display_order, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'Sample Service Task', 'pending', NULL, NULL, 1, 1, NOW(), NOW())`,
                [soId, serviceId, resolvedCustomerName, taskName]
            );
        }

        await conn.commit();
        conn.release();

        return NextResponse.json({
            success: true,
            salesOrderId: soId,
            code,
            customer_name: resolvedCustomerName
        });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('POST /api/services/[id]/sales-orders error:', error);
        return NextResponse.json({ error: 'Failed to create sample sales order', details: error.message }, { status: 500 });
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
