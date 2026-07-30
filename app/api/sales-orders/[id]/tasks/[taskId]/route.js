import { NextResponse } from 'next/server';
import pool, { getWhatsAppDaemonUrl } from '@/lib/db';

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

// ─── Helper to resolve code or ID to numeric ID ─────────────────────────────
async function getSalesOrderId(idOrCode) {
    if (!isNaN(idOrCode)) {
        return parseInt(idOrCode);
    }
    const [orders] = await pool.execute('SELECT id FROM sales_orders WHERE code = ?', [idOrCode]);
    return orders[0]?.id || null;
}

async function syncSalesOrderStatus(salesOrderId) {
    if (!salesOrderId) return;
    try {
        // Fetch sales order's current status
        const [orders] = await pool.execute('SELECT status FROM sales_orders WHERE id = ?', [salesOrderId]);
        if (orders.length === 0) return;
        const currentSoStatus = orders[0].status;

        // If order is already Delivered or Cancelled, do not auto-change its status
        if (currentSoStatus === 'Delivered' || currentSoStatus === 'Cancelled') {
            return;
        }

        // Fetch all tasks for this sales order
        const [tasks] = await pool.execute('SELECT status FROM job_tasks WHERE sales_order_id = ?', [salesOrderId]);
        if (tasks.length === 0) return;

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const inProgressOrPausedTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'paused').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;

        let newSoStatus = currentSoStatus;

        if (completedTasks === totalTasks) {
            newSoStatus = 'Ready';
        } else if (inProgressOrPausedTasks > 0 || (completedTasks > 0 && pendingTasks > 0)) {
            newSoStatus = 'In Production';
        } else if (pendingTasks === totalTasks) {
            newSoStatus = 'Pending';
        }

        if (newSoStatus !== currentSoStatus) {
            console.log(`[Auto-Transition] Sales Order #${salesOrderId} status from ${currentSoStatus} → ${newSoStatus}`);
            await pool.execute('UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE id = ?', [newSoStatus, salesOrderId]);

            // WhatsApp Notification Trigger for Order Ready
            if (newSoStatus === 'Ready') {
                try {
                    // Fetch settings
                    const [waSettingsRows] = await pool.execute(
                        "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('whatsapp_enabled', 'whatsapp_auto_send_ready', 'whatsapp_template_ready')"
                    );
                    const waSettings = waSettingsRows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

                    if (waSettings['whatsapp_enabled'] === 'true' && waSettings['whatsapp_auto_send_ready'] === 'true') {
                        // Fetch customer and order info
                        const [orderRows] = await pool.execute('SELECT code, customer_id, customer_name FROM sales_orders WHERE id = ?', [salesOrderId]);
                        if (orderRows.length > 0) {
                            const order = orderRows[0];
                            let phone = null;
                            let token = null;

                            if (order.customer_id) {
                                const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE id = ?', [order.customer_id]);
                                if (custRows.length > 0) {
                                    phone = custRows[0].phone || custRows[0].contact_phone;
                                    token = custRows[0].portal_token;
                                }
                            }
                            if (!phone && order.customer_name) {
                                const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE name = ?', [order.customer_name]);
                                if (custRows.length > 0) {
                                    phone = custRows[0].phone || custRows[0].contact_phone;
                                    token = custRows[0].portal_token;
                                }
                            }

                            if (phone) {
                                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://erp.neo.lk/';
                                const portalLink = token ? `${baseUrl}portal/${token}` : '';
                                const templateText = waSettings['whatsapp_template_ready'] || 'Hi {customer_name}, your order {order_code} is completed and ready for pickup/delivery! Thank you for choosing Pressmatics.';
                                
                                const message = templateText
                                    .replace(/{customer_name}/g, order.customer_name || '')
                                    .replace(/{order_code}/g, order.code || '')
                                    .replace(/{portal_link}/g, portalLink || '')
                                    .replace(/{order_status}/g, 'Ready');

                                const daemonUrl = await getWhatsAppDaemonUrl();
                                fetch(`${daemonUrl}/api/whatsapp/send`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ number: phone, message })
                                }).then(res => {
                                    if (res.ok) {
                                        console.log(`[WhatsApp Ready Alert] Sent to ${phone} for SO #${salesOrderId}`);
                                    } else {
                                        console.error(`[WhatsApp Ready Alert] Failed to send to ${phone} (status ${res.status})`);
                                    }
                                }).catch(err => {
                                    console.error('[WhatsApp Ready Alert] Fetch error:', err);
                                });
                            }
                        }
                    }
                } catch (waErr) {
                    console.error('Failed to trigger WhatsApp ready notification:', waErr);
                }
            }
        }
    } catch (err) {
        console.error('Failed to sync Sales Order status:', err);
    }
}

export async function PUT(req, { params }) {
    try {
        const resolvedParams = await params;
        const rawId = resolvedParams?.id;
        const { taskId } = resolvedParams;
        if (rawId && rawId !== 'unassigned' && rawId !== 'null' && rawId !== 'undefined') {
            const id = await getSalesOrderId(rawId);
            if (!id) {
                return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
            }
        }

        const body = await req.json();
        const {
            name, status, completed_at, completed_by, assigned_to,
            description, machine_id, machine_name, estimated_minutes,
            scheduled_date, custom_make_ready_minutes, custom_speed, custom_speed_unit,
            quantity, sheet_count, impression_count,
            actual_sheets_printed, actual_sheets_wasted, actual_plates_used,
            downtime_minutes, downtime_reason
        } = body;

        const hasMachineUpdate = Object.prototype.hasOwnProperty.call(body, 'machine_id');

        // Fetch current task to detect in_progress and done transitions
        const [current] = await pool.execute('SELECT status, started_at, sales_order_id FROM job_tasks WHERE id = ?', [taskId]);
        const prevStatus = current[0]?.status;
        const alreadyStarted = current[0]?.started_at;
        const salesOrderId = current[0]?.sales_order_id;

        // Record started_at when moving to in_progress/paused for the first time
        const setStartedAt = (status === 'in_progress' || status === 'paused') && prevStatus === 'pending' && !alreadyStarted;
        
        // Record completed_at when moving to done for the first time if not explicitly provided
        const setCompletedAt = status === 'done' && prevStatus !== 'done' && !completed_at;

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
        } else if (setCompletedAt) {
            updates.push('completed_at = ?');
            paramsList.push(toMySQL(new Date().toISOString()));
        }
        if (setStartedAt) {
            updates.push('started_at = ?');
            paramsList.push(toMySQL(new Date().toISOString()));
        }
        if (completed_by !== undefined) {
            updates.push('completed_by = ?');
            paramsList.push(completed_by || null);
        } else if (setCompletedAt) {
            updates.push('completed_by = ?');
            paramsList.push(assigned_to || current[0]?.assigned_to || 'Operator');
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
        if (scheduled_date !== undefined) {
            updates.push('scheduled_date = ?');
            paramsList.push(scheduled_date || null);
        }
        if (custom_make_ready_minutes !== undefined) {
            updates.push('custom_make_ready_minutes = ?');
            paramsList.push(custom_make_ready_minutes !== null ? parseInt(custom_make_ready_minutes) : null);
        }
        if (custom_speed !== undefined) {
            updates.push('custom_speed = ?');
            paramsList.push(custom_speed !== null ? parseFloat(custom_speed) : null);
        }
        if (custom_speed_unit !== undefined) {
            updates.push('custom_speed_unit = ?');
            paramsList.push(custom_speed_unit || null);
        }
        if (quantity !== undefined) {
            updates.push('quantity = ?');
            paramsList.push(quantity !== null ? parseFloat(quantity) : null);
        }
        if (sheet_count !== undefined) {
            updates.push('sheet_count = ?');
            paramsList.push(sheet_count !== null ? parseFloat(sheet_count) : null);
        }
        if (impression_count !== undefined) {
            updates.push('impression_count = ?');
            paramsList.push(impression_count !== null ? parseFloat(impression_count) : null);
        }
        if (hasMachineUpdate) {
            updates.push('machine_id = ?');
            paramsList.push(machine_id ?? null);
            updates.push('machine_name = ?');
            paramsList.push(machine_name || null);
        }

        // Handle actuals
        if (actual_sheets_printed !== undefined) {
            updates.push('actual_sheets_printed = ?');
            paramsList.push(actual_sheets_printed !== null ? parseFloat(actual_sheets_printed) : null);
        }
        if (actual_sheets_wasted !== undefined) {
            updates.push('actual_sheets_wasted = ?');
            paramsList.push(actual_sheets_wasted !== null ? parseFloat(actual_sheets_wasted) : null);
        }
        if (actual_plates_used !== undefined) {
            updates.push('actual_plates_used = ?');
            paramsList.push(actual_plates_used !== null ? parseInt(actual_plates_used) : null);
        }
        if (downtime_minutes !== undefined) {
            updates.push('downtime_minutes = ?');
            paramsList.push(downtime_minutes !== null ? parseInt(downtime_minutes) : null);
        }
        if (downtime_reason !== undefined) {
            updates.push('downtime_reason = ?');
            paramsList.push(downtime_reason || null);
        }

        updates.push('updated_at = ?');
        paramsList.push(toMySQL(new Date().toISOString()));
        paramsList.push(taskId);

        await pool.execute(
            `UPDATE job_tasks
             SET ${updates.join(', ')}
             WHERE id = ?`,
             paramsList
        );

        // Sync Sales Order status automatically based on task states
        if (salesOrderId) {
            await syncSalesOrderStatus(salesOrderId);
        }

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
        const resolvedParams = await params;
        const { taskId } = resolvedParams;
        if (!taskId) {
            return NextResponse.json({ error: 'Invalid or missing Task ID' }, { status: 400 });
        }

        await pool.execute('DELETE FROM job_tasks WHERE id = ?', [taskId]);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

