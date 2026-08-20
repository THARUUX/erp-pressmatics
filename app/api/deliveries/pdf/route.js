import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import DeliveriesPdfDocument from './DeliveriesPdfDocument';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status') || 'All';

        const [rows] = await pool.execute(`
            SELECT 
                d.id,
                d.sales_order_id,
                d.delivered_quantity,
                d.total_quantity,
                d.status,
                d.delivery_address,
                d.created_at,
                d.updated_at,
                so.code AS sales_order_code,
                so.status AS sales_order_status,
                so.delivery_date AS so_delivery_date,
                c.name AS customer_name,
                q.name AS estimation_name
            FROM deliveries d
            JOIN sales_orders so ON d.sales_order_id = so.id
            JOIN customers c ON so.customer_id = c.id
            LEFT JOIN quotation_items q ON so.quotation_item_id = q.id
            ORDER BY d.created_at DESC
        `);

        let filteredRows = rows;
        if (statusFilter !== 'All') {
            if (['Pending', 'Partially Delivered', 'Delivered'].includes(statusFilter)) {
                filteredRows = rows.filter(r => r.status === statusFilter);
            } else if (['In Production', 'Ready'].includes(statusFilter)) {
                filteredRows = rows.filter(r => r.sales_order_status === statusFilter);
            }
        }

        const pdfBuffer = await renderToBuffer(
            <DeliveriesPdfDocument deliveries={filteredRows} statusFilter={statusFilter} />
        );

        const dateStr = new Date().toISOString().split('T')[0];

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="deliveries-dispatch-report-${dateStr}.pdf"`,
            },
        });
    } catch (error) {
        console.error('Error generating deliveries PDF:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF report', details: error.message },
            { status: 500 }
        );
    }
}
