import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import DeliveryNoteDocument from './DeliveryNoteDocument';

export async function GET(req, { params }) {
    const { dispatchId } = await params;
    try {
        // 1. Fetch Dispatch
        const [dispatchRows] = await pool.execute(
            'SELECT * FROM delivery_dispatches WHERE id = ?',
            [dispatchId]
        );
        if (dispatchRows.length === 0) {
            return NextResponse.json({ error: 'Dispatch shipment not found' }, { status: 404 });
        }
        const dispatch = dispatchRows[0];

        // 2. Fetch associated Delivery
        const [deliveryRows] = await pool.execute(
            'SELECT * FROM deliveries WHERE id = ?',
            [dispatch.delivery_id]
        );
        if (deliveryRows.length === 0) {
            return NextResponse.json({ error: 'Associated delivery not found' }, { status: 404 });
        }
        const delivery = deliveryRows[0];

        // 3. Fetch Sales Order details
        const [soRows] = await pool.execute(
            'SELECT * FROM sales_orders WHERE id = ?',
            [delivery.sales_order_id]
        );
        const salesOrder = soRows[0] || null;

        // 4. Fetch Customer info (address, phone, email)
        let customerAddress = '';
        let customerPhone = '';
        let customerEmail = '';

        if (salesOrder && salesOrder.customer_id) {
            const [custRows] = await pool.execute(
                'SELECT address, phone, contact_phone, email FROM customers WHERE id = ?',
                [salesOrder.customer_id]
            );
            if (custRows.length > 0) {
                customerAddress = custRows[0].address || '';
                customerPhone = custRows[0].phone || custRows[0].contact_phone || '';
                customerEmail = custRows[0].email || '';
            }
        } else if (delivery.customer_name) {
            const [custRows] = await pool.execute(
                'SELECT address, phone, contact_phone, email FROM customers WHERE name = ?',
                [delivery.customer_name]
            );
            if (custRows.length > 0) {
                customerAddress = custRows[0].address || '';
                customerPhone = custRows[0].phone || custRows[0].contact_phone || '';
                customerEmail = custRows[0].email || '';
            }
        }

        // 5. Fetch Settings for Company details
        const [settingsRows] = await pool.execute(
            `SELECT setting_key, setting_value FROM settings 
             WHERE setting_key IN ('company_name', 'company_address', 'company_phone', 'company_email')`
        );
        const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        // 6. Generate PDF Buffer
        const pdfBuffer = await renderToBuffer(
            React.createElement(DeliveryNoteDocument, {
                dispatch,
                delivery,
                salesOrder,
                customer: {
                    name: salesOrder?.customer_name || delivery.customer_name,
                    address: delivery.delivery_address || customerAddress,
                    phone: customerPhone,
                    email: customerEmail
                },
                settings
            })
        );

        const safeSOCode = (salesOrder?.code || delivery.sales_order_code || 'SO').replace(/[^a-z0-9]/gi, '-').toUpperCase();
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="delivery-note-${safeSOCode}-${dispatchId}.pdf"`,
            },
        });
    } catch (error) {
        console.error('Delivery Note PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
