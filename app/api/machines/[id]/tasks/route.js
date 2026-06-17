import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/machines/[id]/tasks
// Returns machine details + all tasks assigned to it, grouped by sales order
export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch machine
        const [machines] = await pool.execute('SELECT * FROM machines WHERE id = ?', [id]);
        if (!machines.length) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
        const machine = machines[0];

        // Fetch all tasks for this machine, joined with sales order info
        const [tasks] = await pool.execute(
            `SELECT jt.*,
                    so.code        AS order_code,
                    so.customer_name,
                    so.status      AS order_status,
                    so.delivery_date,
                    so.total_amount,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names,
                    (SELECT SUM(qi2.quantity)
                     FROM quotation_items qi2
                     JOIN quotation_line_items qli2 ON qi2.id = qli2.quotation_item_id
                     WHERE qli2.quotation_id = so.quotation_id) AS total_units,
                     (SELECT SUM(qid.printed_sheets + qid.wastage_sheets)
                      FROM quotation_item_details qid
                      JOIN quotation_items qi3 ON qid.quotation_item_id = qi3.id
                      JOIN quotation_line_items qli3 ON qi3.id = qli3.quotation_item_id
                      WHERE qli3.quotation_id = so.quotation_id
                        AND qid.machine_id = jt.machine_id) AS total_cut_sheets,
                     (SELECT SUM(qid_i.printed_sheets)
                      FROM quotation_item_details qid_i
                      JOIN quotation_items qi3i ON qid_i.quotation_item_id = qi3i.id
                      JOIN quotation_line_items qli3i ON qi3i.id = qli3i.quotation_item_id
                      WHERE qli3i.quotation_id = so.quotation_id
                        AND qid_i.machine_id = jt.machine_id) AS total_impressions,
                    (SELECT SUM(qid2.plate_count)
                     FROM quotation_item_details qid2
                     JOIN quotation_items qi4 ON qid2.quotation_item_id = qi4.id
                     JOIN quotation_line_items qli4 ON qi4.id = qli4.quotation_item_id
                     WHERE qli4.quotation_id = so.quotation_id
                       AND qid2.machine_id = jt.machine_id) AS total_forms,
                    (SELECT SUM(qif.quantity)
                     FROM quotation_item_finishings qif
                     JOIN quotation_items qi5 ON qif.quotation_item_id = qi5.id
                     JOIN quotation_line_items qli5 ON qi5.id = qli5.quotation_item_id
                     WHERE qli5.quotation_id = so.quotation_id
                       AND qif.machine_id = jt.machine_id) AS total_finishing_qty,
                     (SELECT SUM((qid_p.printed_sheets + qid_p.wastage_sheets) * COALESCE(qid_p.sides, 1))
                      FROM quotation_item_details qid_p
                      JOIN quotation_items qi_p ON qid_p.quotation_item_id = qi_p.id
                      JOIN quotation_line_items qli_p ON qi_p.id = qli_p.quotation_item_id
                      WHERE qli_p.quotation_id = so.quotation_id
                        AND qid_p.machine_id = jt.machine_id) AS total_press_passes
             FROM job_tasks jt
             JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.machine_id = ?
               AND so.status NOT IN ('Delivered','Cancelled')
             ORDER BY jt.machine_position ASC, so.delivery_date ASC, jt.display_order ASC, jt.id ASC`,
            [id]
        );

        // Group tasks by sales order
        const ordersMap = {};
        for (const t of tasks) {
            const key = t.sales_order_id;
            if (!ordersMap[key]) {
                ordersMap[key] = {
                    id: key,
                    code: t.order_code,
                    customer_name: t.customer_name,
                    estimation_names: t.estimation_names || null,
                    status: t.order_status,
                    delivery_date: t.delivery_date,
                    total_amount: t.total_amount,
                    total_units: t.total_units,
                    total_cut_sheets: t.total_cut_sheets,
                    total_impressions: t.total_impressions,
                    total_forms: t.total_forms,
                    total_finishing_qty: t.total_finishing_qty,
                    total_press_passes: t.total_press_passes,
                    tasks: [],
                };
            }
            ordersMap[key].tasks.push({
                id: t.id,
                name: t.name,
                description: t.description,
                status: t.status,
                completed_at: t.completed_at,
                completed_by: t.completed_by,
                display_order: t.display_order,
                machine_position: t.machine_position,
                sales_order_id: t.sales_order_id,
            });
        }

        const orders = Object.values(ordersMap);

        return NextResponse.json({ machine, orders });
    } catch (err) {
        console.error('Machine tasks GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
