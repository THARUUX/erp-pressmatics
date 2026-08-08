import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch service details
        const [services] = await pool.execute('SELECT * FROM services WHERE id = ?', [id]);
        if (services.length === 0) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }
        const service = services[0];

        // Fetch assigned employees
        const [employees] = await pool.execute(
            'SELECT * FROM service_employees WHERE service_id = ? ORDER BY employee_name ASC',
            [id]
        );

        // Fetch tasks matching this service
        const searchPattern = `Service: ${service.name}%`;
        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code AS order_code, 
                    COALESCE(so.customer_name, jt.customer_name) AS customer_name, 
                    so.status AS order_status
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE (jt.name LIKE ? OR jt.service_id = ?) 
               AND (so.status IS NULL OR so.status NOT IN ('Delivered','Cancelled'))
             ORDER BY jt.display_order ASC, jt.id ASC`,
            [searchPattern, id]
        );

        // Fetch quotations for this service
        const [quotations] = await pool.execute(
            `SELECT * FROM quotations WHERE service_id = ? ORDER BY created_at DESC`,
            [id]
        );

        // Fetch invoices for this service
        const [invoices] = await pool.execute(
            `SELECT i.*, (i.amount_due - i.amount_paid) AS balance 
             FROM invoices i 
             WHERE i.service_id = ? 
             ORDER BY i.created_at DESC`,
            [id]
        );

        // Fetch work logs for all tasks
        const taskIds = tasks.map(t => t.id);
        let workLogsMap = {};
        if (taskIds.length > 0) {
            const [allLogs] = await pool.execute(
                `SELECT * FROM job_task_work_logs WHERE task_id IN (${taskIds.map(() => '?').join(',')}) ORDER BY started_at ASC`,
                taskIds
            );
            for (const log of allLogs) {
                if (!workLogsMap[log.task_id]) workLogsMap[log.task_id] = [];
                workLogsMap[log.task_id].push(log);
            }
        }

        const enrichedTasks = tasks.map(task => {
            const logs = workLogsMap[task.id] || [];
            let totalSecs = 0;
            let isRunning = false;
            let runningEmp = null;
            const byEmp = {};

            const now = Date.now();
            for (const log of logs) {
                let secs = log.duration_seconds || 0;
                if (!log.stopped_at && log.started_at) {
                    isRunning = true;
                    runningEmp = log.employee_name;
                    const startMs = new Date(log.started_at).getTime();
                    secs = Math.max(0, Math.floor((now - startMs) / 1000));
                }
                totalSecs += secs;
                byEmp[log.employee_name] = (byEmp[log.employee_name] || 0) + secs;
            }

            return {
                ...task,
                work_logs: logs,
                actual_seconds: totalSecs,
                actual_minutes: Math.round(totalSecs / 60),
                is_running: isRunning,
                running_employee: runningEmp,
                employee_time_breakdown: byEmp,
            };
        });

        return NextResponse.json({
            service: {
                ...service,
                employees: employees.map(e => ({
                    ...e,
                    rate: parseFloat(e.rate)
                }))
            },
            tasks: enrichedTasks,
            quotations: quotations || [],
            invoices: invoices || []
        });
    } catch (error) {
        console.error('GET /api/services/[id]/planning error:', error);
        return NextResponse.json({ error: 'Failed to fetch service planning data' }, { status: 500 });
    }
}

export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { action } = body;

        // Fetch service details
        const [services] = await pool.execute('SELECT * FROM services WHERE id = ?', [id]);
        if (services.length === 0) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }
        const service = services[0];

        if (action === 'create_task') {
            const { task_name, customer_name, notes, estimated_minutes, assigned_to } = body;
            if (!task_name || !customer_name) {
                return NextResponse.json({ error: 'Task name and Customer name are required' }, { status: 400 });
            }

            const name = assigned_to ? `Service: ${service.name} — ${assigned_to}` : `Service: ${service.name}`;
            const description = `Unit: per job · Rate: 0 · Mult: 1 · Note: ${task_name} ${notes ? '- ' + notes : ''}`.trim();

            const [result] = await pool.execute(
                `INSERT INTO job_tasks (name, description, status, assigned_to, estimated_minutes, service_id, customer_name, display_order, created_at, updated_at)
                 VALUES (?, ?, 'pending', ?, ?, ?, ?, 999, NOW(), NOW())`,
                [name, description, assigned_to || null, estimated_minutes || null, id, customer_name]
            );

            return NextResponse.json({ success: true, taskId: result.insertId });
        }

        if (action === 'create_quotation') {
            const {
                customer_name,
                customer_id,
                customer_phone,
                customer_email,
                customer_address,
                tax_mode = 'none',
                tax_percentage = 0,
                terms_and_conditions,
                show_grand_total = true,
                show_signature = true,
                items = []
            } = body;

            if (!customer_name || items.length === 0) {
                return NextResponse.json({ error: 'Customer name and at least one item are required' }, { status: 400 });
            }

            let finalCustomerId = customer_id || null;
            const finalCustomerName = customer_name.trim();

            // If no customer_id is provided, check if we should create or resolve one
            if (!finalCustomerId && finalCustomerName) {
                // Try finding customer with exact matching name
                const [existingCust] = await pool.execute('SELECT id FROM customers WHERE name = ?', [finalCustomerName]);
                if (existingCust.length > 0) {
                    finalCustomerId = existingCust[0].id;
                } else {
                    // Create new customer
                    const [settings] = await pool.execute(
                        "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('customer_id_template', 'customer_id_seq')"
                    );
                    const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

                    let seq = parseInt(settingsMap['customer_id_seq'] || '1');
                    let template = settingsMap['customer_id_template'] || 'CUST-{000}';
                    const code = template.replace('{000}', String(seq).padStart(3, '0')).replace('{SEQ}', String(seq));

                    const [insertResult] = await pool.execute(
                        'INSERT INTO customers (name, email, phone, address, code) VALUES (?, ?, ?, ?, ?)',
                        [finalCustomerName, customer_email || null, customer_phone || null, customer_address || null, code]
                    );
                    finalCustomerId = insertResult.insertId;

                    await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'customer_id_seq'", [String(seq + 1)]);
                }
            }

            // Calculate item amounts with tax
            let totalAmount = 0;
            const computedItems = [];
            const taxMode = tax_mode || 'none';
            const taxPercent = parseFloat(tax_percentage || 0);

            for (const item of items) {
                const qty = parseFloat(item.quantity || 1);
                const price = parseFloat(item.unit_price || 0);
                const itemTotal = qty * price;

                let subtotalAmount = itemTotal;
                let taxAmount = 0;
                let finalItemTotal = itemTotal;

                if (taxMode === 'add') {
                    taxAmount = itemTotal * (taxPercent / 100);
                    subtotalAmount = itemTotal;
                    finalItemTotal = itemTotal + taxAmount;
                } else if (taxMode === 'deduct') {
                    subtotalAmount = itemTotal / (1 + taxPercent / 100);
                    taxAmount = itemTotal - subtotalAmount;
                    finalItemTotal = itemTotal;
                }

                totalAmount += finalItemTotal;
                computedItems.push({
                    ...item,
                    subtotalAmount,
                    taxAmount,
                    finalItemTotal
                });
            }

            // Fetch Settings for Quotation code
            const [settings] = await pool.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('quotation_id_template', 'quotation_id_seq')");
            const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

            let seq = parseInt(settingsMap['quotation_id_seq'] || '1');
            let template = settingsMap['quotation_id_template'] || 'QTN-{0000}';
            const code = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

            const showGrandTotalVal = (show_grand_total === true || show_grand_total === 1 || show_grand_total === '1' || show_grand_total === 'true') ? 1 : 0;
            const showSignatureVal = (show_signature === true || show_signature === 1 || show_signature === '1' || show_signature === 'true') ? 1 : 0;

            // Insert Quotation Header
            const jobDescription = items.map(item => item.item_name).join(', ');
            const [quoteResult] = await pool.execute(
                `INSERT INTO quotations (customer_name, customer_id, total_amount, job_description, code, quotation_date, status, service_id, terms_and_conditions, show_grand_total, show_signature)
                 VALUES (?, ?, ?, ?, ?, NOW(), 'approved', ?, ?, ?, ?)`,
                [finalCustomerName, finalCustomerId, totalAmount, jobDescription, code, id, terms_and_conditions || null, showGrandTotalVal, showSignatureVal]
            );
            const quotationId = quoteResult.insertId;

            // Increment Seq
            await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'quotation_id_seq'", [String(seq + 1)]);

            // Insert Items
            let displayOrder = 1;
            for (const item of computedItems) {
                const itemDesc = item.description || item.job_description || item.item_name;
                const [itemResult] = await pool.execute(
                    `INSERT INTO quotation_items (code, estimation_name, customer_name, item_name, job_description, type, quantity, total_amount, subtotal_amount, status, customer_id, tax_mode, tax_percentage, tax_amount)
                     VALUES (?, ?, ?, ?, ?, 'services', ?, ?, ?, 'linked', ?, ?, ?, ?)`,
                    [
                        code,
                        item.item_name,
                        finalCustomerName,
                        item.item_name,
                        itemDesc,
                        item.quantity,
                        item.finalItemTotal,
                        item.subtotalAmount,
                        finalCustomerId,
                        taxMode,
                        taxPercent,
                        item.taxAmount
                    ]
                );
                const itemId = itemResult.insertId;

                await pool.execute(
                    `INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order)
                     VALUES (?, ?, ?)`,
                    [quotationId, itemId, displayOrder++]
                );
            }

            return NextResponse.json({ success: true, quotationId, code });
        }

        if (action === 'create_invoice') {
            const { customer_name, customer_id, description, amount_due, due_date, notes } = body;
            if (!customer_name || !amount_due) {
                return NextResponse.json({ error: 'Customer name and amount are required' }, { status: 400 });
            }

            const [[{ maxId }]] = await pool.execute('SELECT COALESCE(MAX(id),0) AS maxId FROM invoices');
            const code = `INV-${String(maxId + 1).padStart(4, '0')}`;

            const [result] = await pool.execute(
                `INSERT INTO invoices (code, customer_id, customer_name, description, amount_due, amount_paid, status, due_date, notes, service_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, 'sent', ?, ?, ?, NOW(), NOW())`,
                [code, customer_id || null, customer_name, description || '', parseFloat(amount_due), due_date || null, notes || '', id]
            );

            return NextResponse.json({ success: true, invoiceId: result.insertId, code });
        }

        if (action === 'invoice_quotation') {
            const { quotation_id, due_date, notes } = body;
            if (!quotation_id) {
                return NextResponse.json({ error: 'Quotation ID is required' }, { status: 400 });
            }

            const [quotes] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [quotation_id]);
            if (quotes.length === 0) {
                return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
            }
            const quote = quotes[0];

            const [[{ maxId }]] = await pool.execute('SELECT COALESCE(MAX(id),0) AS maxId FROM invoices');
            const code = `INV-${String(maxId + 1).padStart(4, '0')}`;

            const [result] = await pool.execute(
                `INSERT INTO invoices (code, quotation_id, customer_id, customer_name, description, amount_due, amount_paid, status, due_date, notes, service_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 'sent', ?, ?, ?, NOW(), NOW())`,
                [code, quotation_id, quote.customer_id, quote.customer_name, quote.job_description || '', quote.total_amount, due_date || null, notes || '', id]
            );

            return NextResponse.json({ success: true, invoiceId: result.insertId, code });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('POST /api/services/[id]/planning error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
