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

            const detailIds = details.map(d => d.id);
            const sfgByDetail = {};
            const servicesByDetail = {};
            if (detailIds.length > 0) {
                const placeholders = detailIds.map(() => '?').join(',');
                const [sfgRows] = await pool.execute(
                    `SELECT s.*, i.stock_quantity, i.uom FROM quotation_item_sfg_lines s
                     LEFT JOIN inventory_items i ON i.id = s.inventory_item_id
                     WHERE s.quotation_item_detail_id IN (${placeholders})
                     ORDER BY s.id ASC`,
                    detailIds
                );
                for (const row of sfgRows) {
                    if (!sfgByDetail[row.quotation_item_detail_id]) sfgByDetail[row.quotation_item_detail_id] = [];
                    sfgByDetail[row.quotation_item_detail_id].push(row);
                }

                const [svcRows] = await pool.execute(
                    `SELECT * FROM quotation_item_services
                     WHERE quotation_item_detail_id IN (${placeholders})
                     ORDER BY id ASC`,
                    detailIds
                );
                for (const row of svcRows) {
                    if (!servicesByDetail[row.quotation_item_detail_id]) servicesByDetail[row.quotation_item_detail_id] = [];
                    servicesByDetail[row.quotation_item_detail_id].push(row);
                }
            }

            item.details = details.map(d => ({
                ...d,
                finishings: finishingsByDetail[d.id] || [],
                sfgLines: sfgByDetail[d.id] || [],
                services: servicesByDetail[d.id] || []
            }));
            item.globalFinishings = globalFinishings;
        }
        salesOrder.items = lineItems;

        const [tasks] = await pool.execute('SELECT * FROM job_tasks WHERE sales_order_id = ?', [id]);
        salesOrder.tasks = tasks;

        // Fetch BOM lines
        const [bomRows] = await pool.execute(`
            SELECT sob.*, ii.item_code, ii.uom, ii.stock_quantity AS available_qty
            FROM sales_order_bom sob
            JOIN inventory_items ii ON sob.inventory_item_id = ii.id
            WHERE sob.sales_order_id = ?
        `, [id]);

        if (bomRows.length > 0) {
            salesOrder.bom = bomRows;
        } else if (salesOrder.quotation_id) {
            const [paperNeeds] = await pool.execute(`
                SELECT qid.paper_id AS inventory_item_id, ii.name AS item_name, ii.item_code, ii.uom, ii.stock_quantity AS available_qty, SUM(qid.full_sheets_used) AS qty_needed
                FROM quotation_item_details qid
                JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
                JOIN inventory_items ii ON ii.id = qid.paper_id
                WHERE qli.quotation_id = ? AND qid.paper_id IS NOT NULL AND qid.full_sheets_used > 0
                GROUP BY qid.paper_id, ii.name, ii.item_code, ii.uom, ii.stock_quantity
            `, [salesOrder.quotation_id]);

            const [plateNeeds] = await pool.execute(`
                SELECT m.plate_id AS inventory_item_id, ii.name AS item_name, ii.item_code, ii.uom, ii.stock_quantity AS available_qty, SUM(qid.plate_count) AS qty_needed
                FROM quotation_item_details qid
                JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
                JOIN machines m ON m.id = qid.machine_id
                JOIN inventory_items ii ON ii.id = m.plate_id
                WHERE qli.quotation_id = ? AND qid.plate_count > 0 AND m.plate_id IS NOT NULL
                GROUP BY m.plate_id, ii.name, ii.item_code, ii.uom, ii.stock_quantity
            `, [salesOrder.quotation_id]);

            const [sfgNeeds] = await pool.execute(`
                SELECT sl.inventory_item_id, ii.name AS item_name, ii.item_code, ii.uom, ii.stock_quantity AS available_qty, SUM(sl.quantity) AS qty_needed
                FROM quotation_item_sfg_lines sl
                JOIN quotation_item_details qid ON qid.id = sl.quotation_item_detail_id
                JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
                JOIN inventory_items ii ON ii.id = sl.inventory_item_id
                WHERE qli.quotation_id = ? AND sl.is_statics = 0
                GROUP BY sl.inventory_item_id, ii.name, ii.item_code, ii.uom, ii.stock_quantity
            `, [salesOrder.quotation_id]);

            salesOrder.bom = [
                ...paperNeeds.map(r => ({ component_name: r.item_name, component_type: 'paper', item_code: r.item_code, uom: r.uom, required_qty: Math.ceil(parseFloat(r.qty_needed)), available_qty: r.available_qty })),
                ...plateNeeds.map(r => ({ component_name: r.item_name, component_type: 'plate', item_code: r.item_code, uom: r.uom, required_qty: Math.ceil(parseFloat(r.qty_needed)), available_qty: r.available_qty })),
                ...sfgNeeds.map(r => ({ component_name: r.item_name, component_type: 'sfg', item_code: r.item_code, uom: r.uom, required_qty: parseFloat(r.qty_needed), available_qty: r.available_qty }))
            ];
        } else {
            salesOrder.bom = [];
        }

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
