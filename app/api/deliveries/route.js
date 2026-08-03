import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { syncSalesOrderToDeliveryQueue } from '@/lib/delivery-helper';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || 'All';

        let query = `
            SELECT d.*, 
                   so.delivery_date AS so_delivery_date
            FROM deliveries d
            LEFT JOIN sales_orders so ON d.sales_order_id = so.id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'All') {
            query += ' AND d.status = ?';
            params.push(status);
        }

        if (search) {
            query += ' AND (d.sales_order_code LIKE ? OR d.customer_name LIKE ? OR d.estimation_name LIKE ?)';
            const wildcard = `%${search}%`;
            params.push(wildcard, wildcard, wildcard);
        }

        query += ' ORDER BY d.created_at DESC';

        const [deliveries] = await pool.execute(query, params);

        if (deliveries.length > 0) {
            const deliveryIds = deliveries.map(d => d.id);
            const placeholders = deliveryIds.map(() => '?').join(',');
            
            // Fetch dispatches for these deliveries in one query
            const [dispatches] = await pool.execute(
                `SELECT * FROM delivery_dispatches 
                 WHERE delivery_id IN (${placeholders}) 
                 ORDER BY dispatched_at DESC`,
                deliveryIds
            );

            // Group dispatches by delivery_id
            const dispatchesMap = {};
            for (const dispatch of dispatches) {
                if (!dispatchesMap[dispatch.delivery_id]) {
                    dispatchesMap[dispatch.delivery_id] = [];
                }
                dispatchesMap[dispatch.delivery_id].push(dispatch);
            }

            // Attach dispatches to delivery items
            for (const d of deliveries) {
                d.dispatches = dispatchesMap[d.id] || [];
            }
        }

        return NextResponse.json({ success: true, deliveries });
    } catch (error) {
        console.error('Fetch Deliveries Queue Error:', error);
        return NextResponse.json({ error: 'Failed to fetch deliveries queue' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        // Query all sales orders in Ready status
        const [orders] = await pool.execute(
            "SELECT id FROM sales_orders WHERE status = 'Ready'"
        );

        console.log(`[Manual Delivery Sync] Scanning ${orders.length} Ready Sales Orders`);

        let syncedCount = 0;
        for (const order of orders) {
            await syncSalesOrderToDeliveryQueue(order.id, pool);
            syncedCount++;
        }

        return NextResponse.json({ success: true, message: `Synced ${syncedCount} ready orders to deliveries.` });
    } catch (error) {
        console.error('Manual Delivery Sync Error:', error);
        return NextResponse.json({ error: 'Failed to perform manual sync' }, { status: 500 });
    }
}
