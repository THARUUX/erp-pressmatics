import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const query = `
            SELECT sob.id,
                   sob.sales_order_id,
                   sob.inventory_item_id,
                   sob.component_type,
                   sob.component_name,
                   sob.required_qty,
                   sob.issued_qty,
                   so.code AS sales_order_code,
                   so.customer_name,
                   so.order_date,
                   so.status AS sales_order_status,
                   (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                    FROM quotation_items qi
                    JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                    WHERE qli.quotation_id = so.quotation_id) AS job_name,
                   ii.item_code,
                   ii.uom,
                   ii.stock_quantity AS available_qty
            FROM sales_order_bom sob
            JOIN sales_orders so ON sob.sales_order_id = so.id
            JOIN inventory_items ii ON sob.inventory_item_id = ii.id
            WHERE sob.issued_qty < sob.required_qty
              AND so.status != 'Cancelled'
            ORDER BY so.order_date DESC, sob.id ASC
        `;

        const [rows] = await pool.execute(query);
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Fetch BOM Waiting List Error:", error);
        return NextResponse.json({ error: 'Failed to fetch BOM waiting list', details: error.message }, { status: 500 });
    }
}
