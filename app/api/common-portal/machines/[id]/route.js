import { NextResponse } from 'next/server';
import { pool1, pool2 } from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch machine details from pool1 first, fallback to pool2 if needed
        let [machines1] = await pool1.execute('SELECT * FROM machines WHERE id = ?', [id]);
        let machine = machines1[0];

        if (!machine) {
            const [machines2] = await pool2.execute('SELECT * FROM machines WHERE id = ?', [id]);
            machine = machines2[0];
        }

        if (!machine) {
            return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
        }

        // Search for tasks matching machine_id or machine name across pool1 & pool2
        const [
            [tasks1],
            [tasks2],
            [employees1],
            [employees2]
        ] = await Promise.all([
            pool1.execute(`
                SELECT jt.*,
                       so.code AS order_code,
                       so.customer_name,
                       so.status AS order_status,
                       so.delivery_date,
                       so.total_amount
                FROM job_tasks jt
                JOIN sales_orders so ON jt.sales_order_id = so.id
                WHERE (jt.machine_id = ? OR LOWER(jt.machine_name) = LOWER(?))
                  AND so.status NOT IN ('Delivered', 'Cancelled', 'Ready')
                ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC
            `, [machine.id, machine.name]),
            pool2.execute(`
                SELECT jt.*,
                       so.code AS order_code,
                       so.customer_name,
                       so.status AS order_status,
                       so.delivery_date,
                       so.total_amount
                FROM job_tasks jt
                JOIN sales_orders so ON jt.sales_order_id = so.id
                WHERE (jt.machine_id = ? OR LOWER(jt.machine_name) = LOWER(?))
                  AND so.status NOT IN ('Delivered', 'Cancelled', 'Ready')
                ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC
            `, [machine.id, machine.name]),
            pool1.execute('SELECT id, name FROM employees WHERE status = "active"'),
            pool2.execute('SELECT id, name FROM employees WHERE status = "active"')
        ]);

        const taggedTasks1 = tasks1.map(t => ({ ...t, company_id: 1, company_name: 'Company 1' }));
        const taggedTasks2 = tasks2.map(t => ({ ...t, company_id: 2, company_name: 'Company 2' }));

        const empMap = new Map();
        employees1.forEach(e => empMap.set(e.name, { name: e.name, company_id: 1 }));
        employees2.forEach(e => empMap.set(e.name, { name: e.name, company_id: 2 }));

        return NextResponse.json({
            machine,
            tasks: [...taggedTasks1, ...taggedTasks2],
            employees: Array.from(empMap.values())
        });
    } catch (err) {
        console.error('GET /api/common-portal/machines/[id] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
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
        console.error('PUT /api/common-portal/machines/[id] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
