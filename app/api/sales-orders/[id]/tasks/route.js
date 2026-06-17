import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ─── Generate tasks from actual job components (machine-aware) ───────────────
async function generateJobTasks(id) {
    // Get sales order
    const [orders] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [id]);
    if (!orders.length) return [];
    const order = orders[0];

    // Get line items + details + finishings
    const [lineItems] = await pool.execute(
        `SELECT qi.*, qli.display_order
         FROM quotation_items qi
         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
         WHERE qli.quotation_id = ?
         ORDER BY qli.display_order ASC`,
        [order.quotation_id]
    );

    for (const item of lineItems) {
        const [details] = await pool.execute(
            `SELECT qid.*, m.name as machine_name
             FROM quotation_item_details qid
             LEFT JOIN machines m ON qid.machine_id = m.id
             WHERE qid.quotation_item_id = ?
             ORDER BY qid.id ASC`,
            [item.id]
        );
        const [finishings] = await pool.execute(
            `SELECT qif.*, m.name as machine_name
             FROM quotation_item_finishings qif
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE qif.quotation_item_id = ?`,
            [item.id]
        );
        item.details = details;
        item.finishings = finishings;
    }

    // ── Build task list ────────────────────────────────────────────────────
    // Fetch CTP (prepress) machine for plate making tasks
    const [ctpRows] = await pool.execute("SELECT id, name FROM machines WHERE type = 'prepress' LIMIT 1");
    const ctpMachine = ctpRows[0] || null;

    const taskList = [];
    let order_idx = 0;

    taskList.push({
        name: 'Pre-press / File Check',
        description: 'Check artwork files, preflight & colour profile verification',
        machine_id: ctpMachine?.id || null,
        machine_name: ctpMachine?.name || null,
        display_order: order_idx++
    });

    for (const item of lineItems) {
        const itemName = item.estimation_name || item.job_description || `Item ${item.id}`;

        for (const detail of item.details) {
            const compName = detail.component_name || itemName;
            const machine = detail.machine_name;
            const type = detail.type;

            if (type === 'offset' && compName !== 'Finishing' && machine) {
                const cf = parseInt(detail.colors_front ?? detail.colors ?? 4);
                const cb = parseInt(detail.colors_back ?? 0);
                const colorStr = cb > 0 ? `${cf}+${cb}` : `${cf}`;

                taskList.push({
                    name: `Plate Making — ${compName} (${colorStr} colours)`,
                    description: `${detail.plate_count || (cf + cb)} plates required`,
                    machine_id: ctpMachine?.id || null,
                    machine_name: ctpMachine?.name || null,
                    display_order: order_idx++
                });
                taskList.push({
                    name: `Offset Printing — ${machine} — ${compName}`,
                    description: `${detail.total_sheets || ''} sheets · ${detail.ups || 1} ups · ${detail.sides === 2 ? 'double sided' : 'single sided'}`.trim(),
                    machine_id: detail.machine_id || null,
                    machine_name: machine || null,
                    display_order: order_idx++
                });

            } else if (type === 'digital' && machine) {
                taskList.push({
                    name: `Digital Print — ${machine} — ${compName}`,
                    description: `${detail.total_sheets || ''} sheets`.trim(),
                    machine_id: detail.machine_id || null,
                    machine_name: machine || null,
                    display_order: order_idx++
                });
            }
        }

        // Component-level finishings
        const componentFinishings = item.finishings?.filter(f => f.quotation_item_detail_id != null) || [];
        for (const f of componentFinishings) {
            taskList.push({
                name: `${f.name} — ${itemName}`,
                description: f.machine_name ? `Machine: ${f.machine_name}` : null,
                machine_id: f.machine_id || null,
                machine_name: f.machine_name || null,
                display_order: order_idx++
            });
        }

        // Global (order-level) finishings
        const globalFinishings = item.finishings?.filter(f => f.quotation_item_detail_id == null) || [];
        for (const f of globalFinishings) {
            // Avoid duplicate if already added
            const alreadyAdded = taskList.some(t => t.name.startsWith(f.name));
            if (!alreadyAdded) {
                taskList.push({
                    name: f.name,
                    description: f.machine_name ? `Machine: ${f.machine_name}` : null,
                    machine_id: f.machine_id || null,
                    machine_name: f.machine_name || null,
                    display_order: order_idx++
                });
            }
        }
    }

    taskList.push({ name: 'Quality Check', display_order: order_idx++ });
    taskList.push({ name: 'Packing', display_order: order_idx++ });
    taskList.push({ name: 'Delivery', display_order: order_idx++ });

    // Insert into DB
    for (const t of taskList) {
        await pool.execute(
            'INSERT INTO job_tasks (sales_order_id, name, description, machine_id, machine_name, display_order) VALUES (?, ?, ?, ?, ?, ?)',
            [parseInt(id), t.name, t.description || null, t.machine_id || null, t.machine_name || null, t.display_order]
        );
    }

    const [inserted] = await pool.execute(
        'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC',
        [id]
    );
    return inserted;
}

// ─── Route Handlers ──────────────────────────────────────────────────────────
export async function GET(req, { params }) {
    const { id } = await params;
    const [tasks] = await pool.execute(
        'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC, id ASC',
        [id]
    );
    return NextResponse.json(tasks);
}

export async function POST(req, { params }) {
    const { id } = await params;
    const body = await req.json();

    // Auto-generate from job components (machine-aware)
    if (body.generateDefaults || body.generateFromJob) {
        const tasks = await generateJobTasks(id);
        return NextResponse.json(tasks);
    }

    // Create single task
    const { name, description, assigned_to, display_order } = body;
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const [result] = await pool.execute(
        'INSERT INTO job_tasks (sales_order_id, name, description, assigned_to, display_order) VALUES (?, ?, ?, ?, ?)',
        [parseInt(id), name, description || null, assigned_to || null, display_order ?? 99]
    );
    const [task] = await pool.execute('SELECT * FROM job_tasks WHERE id = ?', [result.insertId]);
    return NextResponse.json(task[0]);
}
