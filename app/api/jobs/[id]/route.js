import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Public endpoint — no auth required (accessed via QR scan)
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch sales order
        const [orders] = await pool.execute(
            'SELECT * FROM sales_orders WHERE id = ?', [id]
        );
        if (!orders.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const order = orders[0];

        // Fetch quotation items (components)
        let items = [];
        if (order.quotation_id) {
            const [lineItems] = await pool.execute(
                `SELECT qi.*, qli.display_order
                 FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = ?
                 ORDER BY qli.display_order ASC`,
                [order.quotation_id]
            );
            for (const item of lineItems) {
                const [details] = await pool.execute(
                    `SELECT qid.*, m.name as machine_name
                     FROM quotation_item_details qid
                     LEFT JOIN machines m ON qid.machine_id = m.id
                     WHERE qid.quotation_item_id = ?
                     ORDER BY qid.id ASC`,
                    [item.id]
                );
                const [finishings] = await pool.execute(
                    `SELECT qif.*, m.name as machine_name
                     FROM quotation_item_finishings qif
                     LEFT JOIN machines m ON qif.machine_id = m.id
                     WHERE qif.quotation_item_id = ?
                     ORDER BY qif.id ASC`,
                    [item.id]
                );
                items.push({ ...item, details, finishings });
            }
        }

        // Fetch tasks
        const [tasks] = await pool.execute(
            'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC, id ASC',
            [id]
        );

        return NextResponse.json({ order, items, tasks });
    } catch (err) {
        console.error('Job GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
