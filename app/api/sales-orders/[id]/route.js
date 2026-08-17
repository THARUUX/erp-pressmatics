import { NextResponse } from 'next/server';
import pool, { getWhatsAppDaemonUrl } from '@/lib/db';
import { syncSalesOrderToDeliveryQueue } from '@/lib/delivery-helper';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch Sales Order
        const [salesOrders] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [id]);
        if (salesOrders.length === 0) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const salesOrder = salesOrders[0];

        // Fetch Customer Phone & Portal Token for WhatsApp
        salesOrder.customer_phone = null;
        salesOrder.customer_portal_token = null;
        if (salesOrder.customer_id) {
            const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE id = ?', [salesOrder.customer_id]);
            if (custRows.length > 0) {
                salesOrder.customer_phone = custRows[0].phone || custRows[0].contact_phone;
                salesOrder.customer_portal_token = custRows[0].portal_token;
            }
        }
        if (!salesOrder.customer_phone && salesOrder.customer_name) {
            const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE name = ?', [salesOrder.customer_name]);
            if (custRows.length > 0) {
                salesOrder.customer_phone = custRows[0].phone || custRows[0].contact_phone;
                salesOrder.customer_portal_token = custRows[0].portal_token;
            }
        }

        // Fetch linked quotation container
        const [quotations] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [salesOrder.quotation_id]);
        salesOrder.quotation = quotations[0] || null;

        // Fetch Quotation Line Items
        const [lineItems] = await pool.execute(
            `SELECT qli.id as link_id, qli.display_order, qi.* 
             FROM quotation_line_items qli
             JOIN quotation_items qi ON qli.quotation_item_id = qi.id
             WHERE qli.quotation_id = ?
             ORDER BY qli.display_order ASC`,
            [salesOrder.quotation_id]
        );

        // Fetch Details and Finishings for each Line Item
        for (let item of lineItems) {
            const [details] = await pool.execute(
                `SELECT qid.*, m.name as machine_name, m.speed as machine_speed, m.speed_unit as machine_speed_unit 
                 FROM quotation_item_details qid
                 LEFT JOIN machines m ON qid.machine_id = m.id
                 WHERE qid.quotation_item_id = ?`,
                [item.id]
            );
            item.details = details;

            const [finishings] = await pool.execute(
                `SELECT qif.*, m.name as machine_name, m.speed, m.speed_unit 
                 FROM quotation_item_finishings qif
                 LEFT JOIN machines m ON qif.machine_id = m.id
                 WHERE qif.quotation_item_id = ?`,
                [item.id]
            );

            // Structure Finishings
            const finishingsByDetail = {};
            const globalFinishings = [];
            for (const f of finishings) {
                const dId = f.quotation_item_detail_id;
                if (dId) {
                    if (!finishingsByDetail[dId]) finishingsByDetail[dId] = [];
                    finishingsByDetail[dId].push(f);
                } else {
                    globalFinishings.push(f);
                }
            }

            // Fetch SFG and Services for item details
            const detailIds = details.map(d => d.id);
            const sfgByDetail = {};
            const servicesByDetail = {};
            if (detailIds.length > 0) {
                const placeholders = detailIds.map(() => '?').join(',');
                const [sfgRows] = await pool.execute(
                    `SELECT s.*, i.stock_quantity, i.uom FROM quotation_item_sfg_lines s
                     LEFT JOIN inventory_items i ON i.id = s.inventory_item_id
                     WHERE s.quotation_item_detail_id IN (${placeholders})
                     ORDER BY s.id ASC`,
                    detailIds
                );
                for (const row of sfgRows) {
                    if (!sfgByDetail[row.quotation_item_detail_id]) sfgByDetail[row.quotation_item_detail_id] = [];
                    sfgByDetail[row.quotation_item_detail_id].push(row);
                }

                const [svcRows] = await pool.execute(
                    `SELECT * FROM quotation_item_services
                     WHERE quotation_item_detail_id IN (${placeholders})
                     ORDER BY id ASC`,
                    detailIds
                );
                for (const row of svcRows) {
                    if (!servicesByDetail[row.quotation_item_detail_id]) servicesByDetail[row.quotation_item_detail_id] = [];
                    servicesByDetail[row.quotation_item_detail_id].push(row);
                }
            }

            item.details = item.details.map(d => ({
                ...d,
                finishings: finishingsByDetail[d.id] || [],
                sfgLines: sfgByDetail[d.id] || [],
                services: servicesByDetail[d.id] || []
            }));
            item.globalFinishings = globalFinishings;
        }

        salesOrder.items = lineItems;

        return NextResponse.json({ salesOrder });

    } catch (error) {
        console.error("Fetch Sales Order Details Error:", error);
        return NextResponse.json({ error: 'Failed to fetch sales order details', details: error.message }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, delivery_date, job_notes, kanban_position } = body;

        // Fetch existing Sales Order first
        const [existing] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [id]);
        if (existing.length === 0) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }
        const oldOrder = existing[0];

        let query = 'UPDATE sales_orders SET ';
        const queryParams = [];
        let hasFields = false;

        if (status) {
            query += 'status = ?';
            queryParams.push(status);
            hasFields = true;
        }

        if (delivery_date !== undefined) {
            if (hasFields) query += ', ';
            query += 'delivery_date = ?';
            queryParams.push(delivery_date || null);
            hasFields = true;
        }

        if (job_notes !== undefined) {
            if (hasFields) query += ', ';
            query += 'job_notes = ?';
            queryParams.push(job_notes || null);
            hasFields = true;
        }

        if (kanban_position !== undefined) {
            if (hasFields) query += ', ';
            query += 'kanban_position = ?';
            queryParams.push(kanban_position);
            hasFields = true;
        }

        if (hasFields) {
            query += ' WHERE id = ?';
            queryParams.push(id);
            await pool.execute(query, queryParams);

            if (status === 'Ready' || status === 'In Production') {
                await syncSalesOrderToDeliveryQueue(id, pool);
            }
        }

        // If status changed to Delivered, check if we should notify via WhatsApp
        if (status === 'Delivered' && oldOrder.status !== 'Delivered') {
            let phone = null;
            let token = null;
            if (oldOrder.customer_id) {
                const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE id = ?', [oldOrder.customer_id]);
                if (custRows.length > 0) {
                    phone = custRows[0].phone || custRows[0].contact_phone;
                    token = custRows[0].portal_token;
                }
            }
            if (!phone && oldOrder.customer_name) {
                const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE name = ?', [oldOrder.customer_name]);
                if (custRows.length > 0) {
                    phone = custRows[0].phone || custRows[0].contact_phone;
                    token = custRows[0].portal_token;
                }
            }

            const [waSettingsRows] = await pool.execute(
                "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('whatsapp_enabled', 'whatsapp_auto_send_dispatch', 'whatsapp_template_dispatch')"
            );
            const waSettings = waSettingsRows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

            if (phone && waSettings['whatsapp_enabled'] === 'true' && waSettings['whatsapp_auto_send_dispatch'] === 'true') {
                const origin = req.headers.get('origin') || 'http://localhost:3000';
                const portalLink = token ? `${origin}/portal/${token}` : '';
                const templateText = waSettings['whatsapp_template_dispatch'] || 'Hello {customer_name}, your order {order_code} is now ready/delivered. View status: {portal_link}';
                
                const message = templateText
                    .replace(/{customer_name}/g, oldOrder.customer_name || '')
                    .replace(/{order_code}/g, oldOrder.code || '')
                    .replace(/{portal_link}/g, portalLink || '')
                    .replace(/{order_status}/g, 'Delivered')
                    .replace(/{delivery_date}/g, delivery_date || '');

                getWhatsAppDaemonUrl().then(daemonUrl => {
                    fetch(`${daemonUrl}/api/whatsapp/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ number: phone, message })
                    }).catch(err => {
                        console.error('Background WhatsApp dispatch send error:', err);
                    });
                }).catch(err => {
                    console.error('Failed to get WhatsApp daemon URL in background:', err);
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update Sales Order Error:", error);
        return NextResponse.json({ error: 'Failed to update sales order' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;

        // Reset quotation status when SO is deleted so Convert to Sales Order is enabled again
        const [salesOrders] = await pool.execute('SELECT quotation_id FROM sales_orders WHERE id = ?', [id]);
        if (salesOrders.length > 0 && salesOrders[0].quotation_id) {
            await pool.execute("UPDATE quotations SET status = 'approved' WHERE id = ?", [salesOrders[0].quotation_id]);
        }

        // Clean up tasks and work logs linked to this SO
        const [soTasks] = await pool.execute(`SELECT id FROM job_tasks WHERE sales_order_id = ?`, [id]);
        const taskIds = soTasks.map(t => t.id);
        if (taskIds.length > 0) {
            await pool.execute(`DELETE FROM job_task_work_logs WHERE task_id IN (${taskIds.map(() => '?').join(',')})`, taskIds);
            await pool.execute(`DELETE FROM job_tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`, taskIds);
        }

        await pool.execute('DELETE FROM sales_orders WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete Sales Order Error:", error);
        return NextResponse.json({ error: 'Failed to delete sales order' }, { status: 500 });
    }
}
