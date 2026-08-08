import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import DeliveryNoteDocument from '../../[dispatchId]/pdf/DeliveryNoteDocument';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const deliveryId = searchParams.get('deliveryId');
    const dispatched_quantity = searchParams.get('dispatched_quantity');
    const books_per_parcel = searchParams.get('books_per_parcel');
    const carrier_name = searchParams.get('carrier_name');
    const tracking_number = searchParams.get('tracking_number');
    const notes = searchParams.get('notes');

    if (!deliveryId) {
        return NextResponse.json({ error: 'deliveryId parameter is required' }, { status: 400 });
    }

    try {
        // 1. Fetch associated Delivery
        const [deliveryRows] = await pool.execute(
            'SELECT * FROM deliveries WHERE id = ?',
            [deliveryId]
        );
        if (deliveryRows.length === 0) {
            return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
        }
        const delivery = deliveryRows[0];

        // 2. Fetch Sales Order details
        const [soRows] = await pool.execute(
            'SELECT * FROM sales_orders WHERE id = ?',
            [delivery.sales_order_id]
        );
        const salesOrder = soRows[0] || null;

        // 3. Fetch Customer info (address, phone, email)
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

        // 4. Fetch Settings for Company details
        const [settingsRows] = await pool.execute(
            `SELECT setting_key, setting_value FROM settings 
             WHERE setting_key IN ('company_name', 'company_address', 'company_phone', 'company_email')`
        );
        const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        // 5. Construct Mock Dispatch Object using inputs
        const parsedQty = parseInt(dispatched_quantity) || 0;
        const parsedRatio = parseInt(books_per_parcel) || parseInt(delivery.books_per_parcel) || 50;
        const parcelsCount = Math.ceil(parsedQty / parsedRatio);

        const dispatch = {
            id: null, // Indicates DRAFT
            dispatched_quantity: parsedQty,
            parcels_count: parcelsCount,
            carrier_name: carrier_name || '',
            tracking_number: tracking_number || '',
            notes: notes || '',
            dispatched_at: new Date().toISOString()
        };

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
                'Content-Disposition': `attachment; filename="delivery-note-${safeSOCode}-preview.pdf"`,
            },
        });
    } catch (error) {
        console.error('Preview Delivery Note PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate preview PDF', detail: error.message }, { status: 500 });
    }
}
