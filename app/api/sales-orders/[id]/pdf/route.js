import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import QRCode from 'qrcode';
import JobTicketDocument from './JobTicketDocument';

export async function GET(req, { params }) {
    const { id } = await params;

    try {
        const [salesOrders] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [id]);
        if (!salesOrders.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const salesOrder = salesOrders[0];

        const [quotations] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [salesOrder.quotation_id]);
        salesOrder.quotation = quotations[0] || null;

        const [lineItems] = await pool.execute(
            `SELECT qli.id as link_id, qli.display_order, qi.*
             FROM quotation_line_items qli
             JOIN quotation_items qi ON qli.quotation_item_id = qi.id
             WHERE qli.quotation_id = ?
             ORDER BY qli.display_order ASC`,
            [salesOrder.quotation_id]
        );

        for (const item of lineItems) {
            const [details] = await pool.execute(
                `SELECT qid.*, m.name as machine_name, m.speed as machine_speed, m.speed_unit as machine_speed_unit
                 FROM quotation_item_details qid
                 LEFT JOIN machines m ON qid.machine_id = m.id
                 WHERE qid.quotation_item_id = ?`,
                [item.id]
            );
            const [finishings] = await pool.execute(
                `SELECT qif.*, m.name as machine_name, m.speed, m.speed_unit
                 FROM quotation_item_finishings qif
                 LEFT JOIN machines m ON qif.machine_id = m.id
                 WHERE qif.quotation_item_id = ?`,
                [item.id]
            );
            const finishingsByDetail = {};
            const globalFinishings = [];
            for (const f of finishings) {
                if (f.quotation_item_detail_id) {
                    if (!finishingsByDetail[f.quotation_item_detail_id]) finishingsByDetail[f.quotation_item_detail_id] = [];
                    finishingsByDetail[f.quotation_item_detail_id].push(f);
                } else {
                    globalFinishings.push(f);
                }
            }
            item.details = details.map(d => ({ ...d, finishings: finishingsByDetail[d.id] || [] }));
            item.globalFinishings = globalFinishings;
        }
        salesOrder.items = lineItems;

        // Generate QR code data URL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const jobUrl = `${baseUrl}/jobs/${id}`;
        const qrDataUrl = await QRCode.toDataURL(jobUrl, {
            width: 120, margin: 1,
            color: { dark: '#1e293b', light: '#ffffff' }
        });

        const pdfBuffer = await renderToBuffer(
            React.createElement(JobTicketDocument, { order: salesOrder, qrDataUrl, jobUrl })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="job-ticket-${salesOrder.code || id}.pdf"`,
            },
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
