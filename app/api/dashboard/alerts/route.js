import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        // 1. Fetch low stock items
        const [lowStockRows] = await pool.execute(`
            SELECT id, name, stock_quantity, min_stock 
            FROM inventory_items 
            WHERE is_active = 1 AND stock_quantity < min_stock
            LIMIT 5
        `);

        // 2. Fetch overdue sales orders
        const [overdueOrdersRows] = await pool.execute(`
            SELECT id, code, customer_name, delivery_date 
            FROM sales_orders 
            WHERE status IN ('Pending', 'In Production') AND delivery_date < CURDATE()
            LIMIT 5
        `);

        const alerts = [];

        // Map low stock
        lowStockRows.forEach(item => {
            alerts.push({
                type: 'low_stock',
                message: `Low stock: ${item.name} (${item.stock_quantity} left, min is ${item.min_stock})`,
                link: '/dashboard/inventory',
                linkText: 'Check Stock',
                severity: 'warning'
            });
        });

        // Map overdue orders
        overdueOrdersRows.forEach(order => {
            let formattedDate = '';
            try {
                const d = new Date(order.delivery_date);
                formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch (e) {
                formattedDate = String(order.delivery_date).substring(0, 10);
            }
            alerts.push({
                type: 'overdue_order',
                message: `Order ${order.code} for ${order.customer_name} was due on ${formattedDate}!`,
                link: `/dashboard/sales-orders/${order.id}`,
                linkText: 'View Order',
                severity: 'critical'
            });
        });

        return NextResponse.json({ alerts });
    } catch (error) {
        console.error('Fetch dashboard alerts error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard alerts' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
