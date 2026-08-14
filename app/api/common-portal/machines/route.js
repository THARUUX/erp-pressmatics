import { NextResponse } from 'next/server';
import { pool1, pool2 } from '@/lib/db';

export async function GET(req) {
    try {
        const taskQuery = `
            SELECT jt.*,
                   so.code AS order_code,
                   so.customer_name,
                   so.status AS order_status,
                   so.delivery_date,
                   so.total_amount,
                   CASE
                     WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qi.type = 'services') > 0 THEN 'services'
                     WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qi.type = 'digital') > 0 THEN 'digital'
                     WHEN (SELECT COUNT(*) FROM quotation_item_details qid JOIN quotation_items qi ON qid.quotation_item_id = qi.id JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = so.quotation_id AND qid.type = 'digital') > 0 THEN 'digital'
                     WHEN jt.service_id IS NOT NULL THEN 'services'
                     ELSE 'offset'
                   END AS job_type
            FROM job_tasks jt
            JOIN sales_orders so ON jt.sales_order_id = so.id
            JOIN machines m ON jt.machine_id = m.id
            WHERE m.is_common = 1 AND so.status NOT IN ('Delivered', 'Cancelled', 'Ready')
            ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC
        `;

        // Fetch common machines and tasks from pool1 and pool2 in parallel
        const [
            [machines1],
            [machines2],
            [tasks1],
            [tasks2],
            [employees1],
            [employees2]
        ] = await Promise.all([
            pool1.execute('SELECT * FROM machines WHERE is_common = 1'),
            pool2.execute('SELECT * FROM machines WHERE is_common = 1'),
            pool1.execute(taskQuery),
            pool2.execute(taskQuery),
            pool1.execute('SELECT id, name FROM employees WHERE status = "active"'),
            pool2.execute('SELECT id, name FROM employees WHERE status = "active"')
        ]);

        // Combine machines (deduplicate by name or keep list)
        const machineNames = new Set();
        const combinedMachines = [];

        [...machines1, ...machines2].forEach(m => {
            if (!machineNames.has(m.name.toLowerCase())) {
                machineNames.add(m.name.toLowerCase());
                combinedMachines.push(m);
            }
        });

        // Tag tasks with originating company
        const taggedTasks1 = tasks1.map(t => ({ ...t, company_id: 1, company_name: 'Company 1' }));
        const taggedTasks2 = tasks2.map(t => ({ ...t, company_id: 2, company_name: 'Company 2' }));

        const allTasks = [...taggedTasks1, ...taggedTasks2];

        // Deduplicate employee list for assignment dropdowns
        const empMap = new Map();
        employees1.forEach(e => empMap.set(e.name, { name: e.name, company_id: 1 }));
        employees2.forEach(e => empMap.set(e.name, { name: e.name, company_id: 2 }));

        return NextResponse.json({
            machines: combinedMachines,
            tasks: allTasks,
            employees: Array.from(empMap.values())
        });
    } catch (err) {
        console.error('GET /api/common-portal/machines error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req) {
    try {
        const body = await req.json();
        const { taskId, companyId, fields } = body;

        if (!taskId || !companyId) {
            return NextResponse.json({ error: 'taskId and companyId are required' }, { status: 400 });
        }

        const targetPool = parseInt(companyId) === 2 ? pool2 : pool1;

        const setClauses = [];
        const queryParams = [];

        Object.keys(fields).forEach(key => {
            setClauses.push(`${key} = ?`);
            queryParams.push(fields[key]);
        });

        if (!setClauses.length) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        queryParams.push(taskId);
        await targetPool.execute(
            `UPDATE job_tasks SET ${setClauses.join(', ')} WHERE id = ?`,
            queryParams
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('PUT /api/common-portal/machines error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
