import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import DeliveriesReportPdfDocument from './DeliveriesReportPdfDocument';
import { syncSalesOrderToDeliveryQueue } from '@/lib/delivery-helper';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || 'All';

        // Auto-sync any unsynced Ready or In Production sales orders
        try {
            const [unsyncedOrders] = await pool.execute(`
                SELECT id FROM sales_orders 
                WHERE status IN ('Ready', 'In Production') 
                  AND id NOT IN (SELECT DISTINCT sales_order_id FROM deliveries WHERE sales_order_id IS NOT NULL)
            `);
            for (const order of unsyncedOrders) {
                await syncSalesOrderToDeliveryQueue(order.id, pool);
            }
        } catch (syncErr) {
            console.error('Auto-sync deliveries error in PDF route:', syncErr);
        }

        let query = `
            SELECT d.*, 
                   so.delivery_date AS so_delivery_date,
                   so.status AS sales_order_status
            FROM deliveries d
            LEFT JOIN sales_orders so ON d.sales_order_id = so.id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'All') {
            if (['Pending', 'Partially Delivered', 'Delivered'].includes(status)) {
                query += ' AND d.status = ?';
                params.push(status);
            } else if (['In Production', 'Ready'].includes(status)) {
                query += ' AND so.status = ?';
                params.push(status);
            }
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
            
            const [dispatches] = await pool.execute(
                `SELECT * FROM delivery_dispatches 
                 WHERE delivery_id IN (${placeholders}) 
                 ORDER BY dispatched_at DESC`,
                deliveryIds
            );

            const dispatchesMap = {};
            for (const dispatch of dispatches) {
                if (!dispatchesMap[dispatch.delivery_id]) {
                    dispatchesMap[dispatch.delivery_id] = [];
                }
                dispatchesMap[dispatch.delivery_id].push(dispatch);
            }

            for (const d of deliveries) {
                d.dispatches = dispatchesMap[d.id] || [];
            }
        }

        // Calculate summary statistics
        let totalOrdered = 0;
        let totalDelivered = 0;
        let totalParcels = 0;

        deliveries.forEach(d => {
            totalOrdered += Number(d.total_quantity || 0);
            totalDelivered += Number(d.delivered_quantity || 0);
            if (d.dispatches) {
                d.dispatches.forEach(disp => {
                    totalParcels += Number(disp.parcels_count || 0);
                });
            }
        });

        const stats = {
            totalOrdered,
            totalDelivered,
            totalParcels
        };

        const pdfBuffer = await renderToBuffer(
            React.createElement(DeliveriesReportPdfDocument, {
                deliveries,
                stats,
                filterStatus: status
            })
        );

        const dateStr = new Date().toISOString().split('T')[0];

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Deliveries_And_Dispatch_Report_${dateStr}.pdf"`,
            },
        });
    } catch (error) {
        console.error('Deliveries PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate Deliveries PDF report', detail: error.message }, { status: 500 });
    }
}
