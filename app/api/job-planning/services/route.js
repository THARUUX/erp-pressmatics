import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        // Fetch all job tasks that are services
        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code AS order_code, COALESCE(so.customer_name, jt.customer_name) AS customer_name
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE (jt.name LIKE 'Service:%' OR jt.service_id IS NOT NULL) 
               AND (so.status IS NULL OR so.status NOT IN ('Delivered','Cancelled','Ready'))
             ORDER BY jt.display_order ASC, jt.id ASC`
        );

        // Fetch list of distinct employee names for assignment dropdowns
        const [employeesRows] = await pool.execute(
            'SELECT DISTINCT employee_name FROM service_employees ORDER BY employee_name ASC'
        );
        const employees = employeesRows.map(row => row.employee_name);

        return NextResponse.json({ tasks, employees });
    } catch (error) {
        console.error('GET /api/job-planning/services error:', error);
        return NextResponse.json({ error: 'Failed to fetch services tasks' }, { status: 500 });
    }
}
