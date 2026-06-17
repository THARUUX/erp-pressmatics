import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch Sales Order
        const [salesOrders] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [id]);
        if (salesOrders.length === 0) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const salesOrder = salesOrders[0];

        // Fetch linked quotation container
        const [quotations] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [salesOrder.quotation_id]);
        salesOrder.quotation = quotations[0] || null;

        // Fetch Quotation Line Items
        const [lineItems] = await pool.execute(
            `SELECT qli.id as link_id, qli.display_order, qi.* 
             FROM quotation_line_items qli
             JOIN quotation_items qi ON qli.quotation_item_id = qi.id
             WHERE qli.quotation_id = ?
             ORDER BY qli.display_order ASC`,
            [salesOrder.quotation_id]
        );

        // Fetch Details and Finishings for each Line Item
        for (let item of lineItems) {
            const [details] = await pool.execute(
                `SELECT qid.*, m.name as machine_name, m.speed as machine_speed, m.speed_unit as machine_speed_unit 
                 FROM quotation_item_details qid
                 LEFT JOIN machines m ON qid.machine_id = m.id
                 WHERE qid.quotation_item_id = ?`,
                [item.id]
            );
            item.details = details;

            const [finishings] = await pool.execute(
                `SELECT qif.*, m.name as machine_name, m.speed, m.speed_unit 
                 FROM quotation_item_finishings qif
                 LEFT JOIN machines m ON qif.machine_id = m.id
                 WHERE qif.quotation_item_id = ?`,
                [item.id]
            );

            // Structure Finishings
            const finishingsByDetail = {};
            const globalFinishings = [];
            for (const f of finishings) {
                const dId = f.quotation_item_detail_id;
                if (dId) {
                    if (!finishingsByDetail[dId]) finishingsByDetail[dId] = [];
                    finishingsByDetail[dId].push(f);
                } else {
                    globalFinishings.push(f);
                }
            }

            item.details = item.details.map(d => ({
                ...d,
                finishings: finishingsByDetail[d.id] || []
            }));
            item.globalFinishings = globalFinishings;
        }

        salesOrder.items = lineItems;

        return NextResponse.json({ salesOrder });

    } catch (error) {
        console.error("Fetch Sales Order Details Error:", error);
        return NextResponse.json({ error: 'Failed to fetch sales order details', details: error.message }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, delivery_date } = body;

        let query = 'UPDATE sales_orders SET ';
        const queryParams = [];

        if (status) {
            query += 'status = ?';
            queryParams.push(status);
        }

        if (delivery_date !== undefined) {
            if (status) query += ', ';
            query += 'delivery_date = ?';
            queryParams.push(delivery_date || null);
        }

        query += ' WHERE id = ?';
        queryParams.push(id);

        await pool.execute(query, queryParams);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update Sales Order Error:", error);
        return NextResponse.json({ error: 'Failed to update sales order' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;

        // Optional: Reset quotation status when SO is deleted
        const [salesOrders] = await pool.execute('SELECT quotation_id FROM sales_orders WHERE id = ?', [id]);
        if (salesOrders.length > 0 && salesOrders[0].quotation_id) {
            await pool.execute("UPDATE quotations SET status = 'draft' WHERE id = ?", [salesOrders[0].quotation_id]);
        }

        await pool.execute('DELETE FROM sales_orders WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete Sales Order Error:", error);
        return NextResponse.json({ error: 'Failed to delete sales order' }, { status: 500 });
    }
}
