import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        // --- KPI Totals ---
        const [[invoiceStats]] = await pool.execute(`
            SELECT
                COUNT(*)                                                         AS total_invoices,
                COALESCE(SUM(amount_due), 0)                                    AS total_revenue,
                COALESCE(SUM(amount_paid), 0)                                   AS total_collected,
                COALESCE(SUM(CASE WHEN status IN ('sent','partial') THEN amount_due - amount_paid ELSE 0 END), 0) AS outstanding,
                COALESCE(SUM(CASE WHEN status = 'overdue'           THEN amount_due - amount_paid ELSE 0 END), 0) AS overdue,
                COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN amount_paid ELSE 0 END), 0) AS collected_this_month
            FROM invoices
        `);

        const [[quotationStats]] = await pool.execute(`
            SELECT
                COUNT(*) AS total_quotations,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) AS accepted,
                COUNT(CASE WHEN status = 'pending'  THEN 1 END) AS pending,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected
            FROM quotations
        `);

        const [[customerStats]] = await pool.execute(`
            SELECT
                COUNT(*) AS total_customers,
                COUNT(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 END) AS new_this_month
            FROM customers
        `);

        const [[inventoryStats]] = await pool.execute(`
            SELECT
                COUNT(*) AS total_items,
                COUNT(CASE WHEN min_stock IS NOT NULL AND stock_quantity < min_stock THEN 1 END) AS low_stock_count
            FROM inventory_items
        `);

        const [[salesOrderStats]] = await pool.execute(`
            SELECT COUNT(*) AS total_sales_orders FROM sales_orders
        `);

        // --- Revenue last 6 months ---
        const [revenueByMonth] = await pool.execute(`
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                DATE_FORMAT(MIN(created_at), '%b %Y') AS label,
                COALESCE(SUM(amount_paid), 0) AS collected,
                COALESCE(SUM(amount_due),  0) AS billed
            FROM invoices
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        `);

        // --- Quotations by status (pie) ---
        const [quotationsByStatus] = await pool.execute(`
            SELECT status, COUNT(*) AS count FROM quotations GROUP BY status
        `);

        // --- Invoice status breakdown (pie) ---
        const [invoicesByStatus] = await pool.execute(`
            SELECT status, COUNT(*) AS count FROM invoices GROUP BY status
        `);

        // --- Recent 5 invoices ---
        const [recentInvoices] = await pool.execute(`
            SELECT code, customer_name, amount_due, amount_paid, status, created_at
            FROM invoices
            ORDER BY created_at DESC
            LIMIT 5
        `);

        // --- Top 5 customers by revenue ---
        const [topCustomers] = await pool.execute(`
            SELECT customer_name, COALESCE(SUM(amount_paid), 0) AS revenue
            FROM invoices
            GROUP BY customer_name
            ORDER BY revenue DESC
            LIMIT 5
        `);

        // --- Low stock items ---
        const [lowStock] = await pool.execute(`
            SELECT name, stock_quantity, min_stock, uom
            FROM inventory_items
            WHERE min_stock IS NOT NULL AND stock_quantity < min_stock
            ORDER BY (stock_quantity - min_stock) ASC
            LIMIT 6
        `);

        // ─── Profit Analytics (converted quotations only) ──────────────
        // Raw cost = sum of all detail-level costs; markup profit = subtotal - raw_cost
        const [profitRows] = await pool.execute(`
            SELECT
                q.id              AS quotation_id,
                q.code            AS quotation_code,
                q.customer_name,
                q.created_at,
                COUNT(DISTINCT so.id)                                       AS so_count,
                ROUND(SUM(qid_agg.raw_cost), 2)                             AS total_cost,
                ROUND(SUM(qi.subtotal_amount), 2)                           AS total_billed_ex_tax,
                ROUND(SUM(qi.total_amount), 2)                              AS total_billed_inc_tax,
                ROUND(SUM(qi.subtotal_amount - qid_agg.raw_cost), 2)        AS markup_profit,
                ROUND(
                    CASE WHEN SUM(qid_agg.raw_cost) > 0
                        THEN SUM(qi.subtotal_amount - qid_agg.raw_cost) / SUM(qid_agg.raw_cost) * 100
                        ELSE 0
                    END, 2)                                                  AS margin_pct,
                ROUND(AVG(qi.markup_percent), 2)                            AS avg_markup_pct
            FROM quotations q
            JOIN quotation_line_items qli ON qli.quotation_id = q.id
            JOIN quotation_items qi      ON qi.id = qli.quotation_item_id
            JOIN (
                SELECT quotation_item_id,
                    SUM(COALESCE(final_paper_cost,0)
                        + COALESCE(final_plate_cost,0)
                        + COALESCE(final_printing_cost,0)
                        + COALESCE(final_finishing_cost,0)) AS raw_cost
                FROM quotation_item_details
                GROUP BY quotation_item_id
            ) qid_agg ON qid_agg.quotation_item_id = qi.id
            JOIN sales_orders so ON so.quotation_id = q.id
            WHERE q.status = 'converted'
            GROUP BY q.id, q.code, q.customer_name, q.created_at
            ORDER BY markup_profit DESC
        `);

        // KPI totals across all converted quotations
        const profitKpi = profitRows.reduce((acc, r) => {
            acc.totalCost        += Number(r.total_cost);
            acc.totalBilled      += Number(r.total_billed_ex_tax);
            acc.totalProfit      += Number(r.markup_profit);
            acc.totalOrders      += Number(r.so_count);
            return acc;
        }, { totalCost: 0, totalBilled: 0, totalProfit: 0, totalOrders: 0 });
        profitKpi.avgMarginPct = profitKpi.totalBilled > 0
            ? ((profitKpi.totalProfit / profitKpi.totalCost) * 100).toFixed(2)
            : 0;

        // Monthly profit trend (cost vs billed by SO creation month, last 6 months)
        const [profitByMonth] = await pool.execute(`
            SELECT
                DATE_FORMAT(so.created_at, '%Y-%m')      AS month,
                DATE_FORMAT(MIN(so.created_at), '%b %Y') AS label,
                ROUND(SUM(qid_agg.raw_cost), 2)          AS cost,
                ROUND(SUM(qi.subtotal_amount), 2)         AS billed,
                ROUND(SUM(qi.subtotal_amount - qid_agg.raw_cost), 2) AS profit
            FROM sales_orders so
            JOIN quotations q ON q.id = so.quotation_id
            JOIN quotation_line_items qli ON qli.quotation_id = q.id
            JOIN quotation_items qi ON qi.id = qli.quotation_item_id
            JOIN (
                SELECT quotation_item_id,
                    SUM(COALESCE(final_paper_cost,0)
                        + COALESCE(final_plate_cost,0)
                        + COALESCE(final_printing_cost,0)
                        + COALESCE(final_finishing_cost,0)) AS raw_cost
                FROM quotation_item_details
                GROUP BY quotation_item_id
            ) qid_agg ON qid_agg.quotation_item_id = qi.id
            WHERE so.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(so.created_at, '%Y-%m')
            ORDER BY month ASC
        `);

        return NextResponse.json({
            kpi: {
                totalRevenue:       Number(invoiceStats.total_revenue),
                totalCollected:     Number(invoiceStats.total_collected),
                outstanding:        Number(invoiceStats.outstanding),
                overdue:            Number(invoiceStats.overdue),
                collectedThisMonth: Number(invoiceStats.collected_this_month),
                totalInvoices:      Number(invoiceStats.total_invoices),
                totalQuotations:    Number(quotationStats.total_quotations),
                acceptedQuotations: Number(quotationStats.accepted),
                totalCustomers:     Number(customerStats.total_customers),
                newCustomers:       Number(customerStats.new_this_month),
                totalItems:         Number(inventoryStats.total_items),
                lowStockCount:      Number(inventoryStats.low_stock_count),
                totalSalesOrders:   Number(salesOrderStats.total_sales_orders),
            },
            revenueByMonth,
            quotationsByStatus,
            invoicesByStatus,
            recentInvoices,
            topCustomers,
            lowStock,
            profitKpi,
            profitRows: profitRows.map(r => ({
                quotation_id:        r.quotation_id,
                quotation_code:      r.quotation_code,
                customer_name:       r.customer_name,
                created_at:          r.created_at,
                so_count:            Number(r.so_count),
                total_cost:          Number(r.total_cost),
                total_billed_ex_tax: Number(r.total_billed_ex_tax),
                total_billed_inc_tax:Number(r.total_billed_inc_tax),
                markup_profit:       Number(r.markup_profit),
                margin_pct:          Number(r.margin_pct),
                avg_markup_pct:      Number(r.avg_markup_pct),
            })),
            profitByMonth: profitByMonth.map(r => ({
                month:  r.month,
                label:  r.label,
                cost:   Number(r.cost),
                billed: Number(r.billed),
                profit: Number(r.profit),
            })),
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
