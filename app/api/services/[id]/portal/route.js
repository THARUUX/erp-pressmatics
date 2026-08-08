import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        const [services] = await pool.execute('SELECT * FROM services WHERE id = ?', [id]);
        if (services.length === 0) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }
        const service = services[0];

        const [serviceEmployees] = await pool.execute(
            'SELECT * FROM service_employees WHERE service_id = ? ORDER BY employee_name ASC',
            [id]
        );
        service.employees = serviceEmployees.map(e => ({
            ...e,
            rate: parseFloat(e.rate)
        }));

        // ── 1. Quotations Stats (strictly scoped to this service) ──────────────
        const [[qStats]] = await pool.execute(
            `SELECT
                COUNT(*) AS total_quotations,
                COALESCE(SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END), 0) AS converted_quotations,
                COALESCE(SUM(CASE WHEN status IN ('draft','sent','approved') THEN 1 ELSE 0 END), 0) AS open_quotations,
                COALESCE(SUM(total_amount), 0) AS total_quoted
             FROM quotations WHERE service_id = ?`,
            [id]
        );

        // ── 2. Sales Orders Stats (strictly scoped to this service) ────────────
        const [[soStats]] = await pool.execute(
            `SELECT
                COUNT(*) AS total_orders,
                COALESCE(SUM(CASE WHEN status NOT IN ('Delivered','Cancelled') THEN 1 ELSE 0 END), 0) AS active_orders,
                COALESCE(SUM(total_amount), 0) AS total_order_value
             FROM sales_orders WHERE service_id = ?`,
            [id]
        );

        // ── 3. Tasks Stats (strictly scoped to this service or its SOs) ───────
        const [[taskStats]] = await pool.execute(
            `SELECT
                COUNT(*) AS total_tasks,
                COALESCE(SUM(CASE WHEN status IN ('pending','in_progress') THEN 1 ELSE 0 END), 0) AS active_tasks,
                COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress_tasks,
                COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done_tasks
             FROM job_tasks
             WHERE service_id = ? OR sales_order_id IN (SELECT id FROM sales_orders WHERE service_id = ?)`,
            [id, id]
        );

        // ── 4. Invoices / Revenue Stats (strictly scoped to this service) ──────
        const [[invoiceStats]] = await pool.execute(
            `SELECT
                COUNT(*) AS count,
                COALESCE(SUM(amount_paid), 0) AS total_collected,
                COALESCE(SUM(amount_due - amount_paid), 0) AS total_outstanding,
                COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN amount_paid ELSE 0 END), 0) AS this_month_collected
             FROM invoices WHERE service_id = ?`,
            [id]
        );

        let totalRevenue = Number(invoiceStats.total_collected);
        let totalOutstanding = Number(invoiceStats.total_outstanding);
        let thisMonthCollected = Number(invoiceStats.this_month_collected);

        // Fallback to Sales Orders for this service if no invoices exist
        if (Number(invoiceStats.count) === 0 || totalRevenue === 0) {
            const [[soRev]] = await pool.execute(
                `SELECT
                    COALESCE(SUM(total_amount), 0) AS total_collected,
                    COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN total_amount ELSE 0 END), 0) AS this_month_collected
                 FROM sales_orders
                 WHERE service_id = ? AND status != 'Cancelled'`,
                [id]
            );
            totalRevenue = Number(soRev.total_collected);
            thisMonthCollected = Number(soRev.this_month_collected);
        }

        // ── 5. Monthly Revenue Chart Data ─────────────────────────────────────
        let [monthlyRevenueRows] = await pool.execute(
            `SELECT
                DATE_FORMAT(created_at, '%b %Y') AS label,
                SUM(amount_paid) AS value,
                SUM(amount_paid) AS collected,
                SUM(amount_due) AS invoiced
             FROM invoices
             WHERE service_id = ?
               AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
             ORDER BY MIN(created_at) ASC`,
            [id]
        );

        if (!monthlyRevenueRows || monthlyRevenueRows.length === 0) {
            [monthlyRevenueRows] = await pool.execute(
                `SELECT
                    DATE_FORMAT(created_at, '%b %Y') AS label,
                    SUM(total_amount) AS value,
                    SUM(total_amount) AS collected,
                    SUM(total_amount) AS invoiced
                 FROM sales_orders
                 WHERE service_id = ?
                   AND status != 'Cancelled'
                   AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                 GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
                 ORDER BY MIN(created_at) ASC`,
                [id]
            );
        }

        // ── 6. Monthly Quotations Chart Data ──────────────────────────────────
        const [monthlyQuotationsRows] = await pool.execute(
            `SELECT
                DATE_FORMAT(created_at, '%b %Y') AS label,
                COUNT(*) AS value,
                COUNT(*) AS count,
                SUM(total_amount) AS total_value
             FROM quotations
             WHERE service_id = ?
               AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
             ORDER BY MIN(created_at) ASC`,
            [id]
        );

        // ── 7. Recent Quotations ───────────────────────────────────────────────
        const [recentQuotationsRaw] = await pool.execute(
            `SELECT id, code, customer_name, total_amount, status, created_at
             FROM quotations WHERE service_id = ?
             ORDER BY created_at DESC LIMIT 5`,
            [id]
        );
        const recentQuotations = recentQuotationsRaw.map(q => ({
            ...q,
            quotation_number: q.code || `#${q.id}`,
            grand_total: parseFloat(q.total_amount || 0),
        }));

        // ── 8. Recent Tasks ───────────────────────────────────────────────────
        const [recentTasksRaw] = await pool.execute(
            `SELECT id, name, status, assigned_to, sales_order_id, customer_name, created_at
             FROM job_tasks
             WHERE service_id = ? OR sales_order_id IN (SELECT id FROM sales_orders WHERE service_id = ?)
             ORDER BY created_at DESC LIMIT 5`,
            [id, id]
        );
        const recentTasks = recentTasksRaw.map(t => ({
            ...t,
            actual_seconds: 0,
        }));

        const monthlyRevenue = monthlyRevenueRows.map(r => ({
            label: r.label,
            value: Number(r.value || 0),
            collected: Number(r.collected || 0),
            invoiced: Number(r.invoiced || 0),
        }));

        const monthlyQuotations = monthlyQuotationsRows.map(r => ({
            label: r.label,
            value: Number(r.value || 0),
            count: Number(r.count || 0),
            total_value: Number(r.total_value || 0),
        }));

        return NextResponse.json({
            service,
            stats: {
                totalRevenue,
                convertedQuotationsCount: Number(qStats.converted_quotations),
                totalQuotations: Number(qStats.total_quotations),
                totalQuotationsValue: Number(qStats.total_quoted),
                totalSalesOrders: Number(soStats.total_orders),
                activeTasksCount: Number(taskStats.active_tasks),
                inProgressTasksCount: Number(taskStats.in_progress_tasks),
                monthlyRevenue,
                monthlyQuotations,

                // Legacy nested structures
                quotations: {
                    total: Number(qStats.total_quotations),
                    open: Number(qStats.open_quotations),
                    total_quoted: Number(qStats.total_quoted),
                },
                sales_orders: {
                    total: Number(soStats.total_orders),
                    active: Number(soStats.active_orders),
                    total_value: Number(soStats.total_order_value),
                },
                tasks: {
                    total: Number(taskStats.total_tasks),
                    done: Number(taskStats.done_tasks),
                    active: Number(taskStats.active_tasks),
                },
                invoices: {
                    collected: totalRevenue,
                    outstanding: totalOutstanding,
                    this_month: thisMonthCollected,
                },
            },
            monthly_revenue: monthlyRevenue,
            monthly_quotations: monthlyQuotations,
            recent_quotations: recentQuotations,
            recent_tasks: recentTasks,
        });
    } catch (error) {
        console.error('GET /api/services/[id]/portal error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
