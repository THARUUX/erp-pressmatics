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
        // Service tasks are named: "Service: <ServiceName> — <EmployeeName>" or "Service: <ServiceName>"
        const searchPattern = `Service: ${service.name}%`;
        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code AS order_code, so.customer_name AS customer_name, so.status AS order_status
             FROM job_tasks jt
             JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.name LIKE ? AND so.status NOT IN ('Delivered','Cancelled','Ready')
             ORDER BY jt.display_order ASC, jt.id ASC`,
            [searchPattern]
        );

        return NextResponse.json({
            service: {
                ...service,
                employees: employees.map(e => ({
                    ...e,
                    rate: parseFloat(e.rate)
                }))
            },
            tasks
        });
    } catch (error) {
        console.error('GET /api/services/[id]/planning error:', error);
        return NextResponse.json({ error: 'Failed to fetch service planning data' }, { status: 500 });
    }
}
