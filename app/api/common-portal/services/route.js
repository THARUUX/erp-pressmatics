import { NextResponse } from 'next/server';
import { pool1, pool2 } from '@/lib/db';

export async function GET(req) {
    try {
        const [
            [services1],
            [services2],
            [tasks1],
            [tasks2],
            [employees1],
            [employees2]
        ] = await Promise.all([
            pool1.execute('SELECT * FROM services WHERE is_common = 1'),
            pool2.execute('SELECT * FROM services WHERE is_common = 1'),
            pool1.execute(`
                SELECT jt.*,
                       so.code AS order_code,
                       COALESCE(so.customer_name, jt.customer_name) AS customer_name,
                       so.status AS order_status,
                       so.delivery_date,
                       s.name AS service_name
                FROM job_tasks jt
                LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                LEFT JOIN services s ON jt.service_id = s.id
                WHERE (s.is_common = 1 OR jt.service_id IS NOT NULL OR jt.name LIKE 'Service:%')
                  AND (so.status IS NULL OR so.status NOT IN ('Delivered', 'Cancelled'))
                ORDER BY jt.created_at DESC
            `),
            pool2.execute(`
                SELECT jt.*,
                       so.code AS order_code,
                       COALESCE(so.customer_name, jt.customer_name) AS customer_name,
                       so.status AS order_status,
                       so.delivery_date,
                       s.name AS service_name
                FROM job_tasks jt
                LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                LEFT JOIN services s ON jt.service_id = s.id
                WHERE (s.is_common = 1 OR jt.service_id IS NOT NULL OR jt.name LIKE 'Service:%')
                  AND (so.status IS NULL OR so.status NOT IN ('Delivered', 'Cancelled'))
                ORDER BY jt.created_at DESC
            `),
            pool1.execute('SELECT id, employee_name FROM service_employees'),
            pool2.execute('SELECT id, employee_name FROM service_employees')
        ]);

        const serviceNames = new Set();
        const combinedServices = [];
        [...services1, ...services2].forEach(s => {
            if (!serviceNames.has(s.name.toLowerCase())) {
                serviceNames.add(s.name.toLowerCase());
                combinedServices.push(s);
            }
        });

        const taggedTasks1 = tasks1.map(t => ({ ...t, company_id: 1, company_name: 'Company 1' }));
        const taggedTasks2 = tasks2.map(t => ({ ...t, company_id: 2, company_name: 'Company 2' }));

        const allTasks = [...taggedTasks1, ...taggedTasks2];

        // Filter unplanned queue vs planned
        const unplannedQueue = allTasks.filter(t => !t.planned_date || t.status === 'pending');
        const plannedTasks = allTasks.filter(t => t.planned_date && t.status !== 'pending');

        const empMap = new Map();
        employees1.forEach(e => empMap.set(e.employee_name, { name: e.employee_name, company_id: 1 }));
        employees2.forEach(e => empMap.set(e.employee_name, { name: e.employee_name, company_id: 2 }));

        return NextResponse.json({
            services: combinedServices,
            tasks: allTasks,
            unplannedQueue,
            plannedTasks,
            employees: Array.from(empMap.values())
        });
    } catch (err) {
        console.error('GET /api/common-portal/services error:', err);
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
        console.error('PUT /api/common-portal/services error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
