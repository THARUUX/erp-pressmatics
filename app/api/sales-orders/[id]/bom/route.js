import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    const { id } = await params;
    try {
        // Fetch BOM lines
        const [bomLines] = await pool.execute(`
            SELECT sob.*, ii.item_code, ii.uom, ii.stock_quantity AS available_qty
            FROM sales_order_bom sob
            JOIN inventory_items ii ON sob.inventory_item_id = ii.id
            WHERE sob.sales_order_id = ?
        `, [id]);

        if (bomLines.length > 0) {
            return NextResponse.json(bomLines);
        }

        // If no BOM lines exist, let's backfill it for compatibility with old orders.
        const [orders] = await pool.execute('SELECT quotation_id, auto_deduct_stock FROM sales_orders WHERE id = ?', [id]);
        if (orders.length === 0) {
            return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
        }

        const { quotation_id } = orders[0];
        if (!quotation_id) {
            return NextResponse.json([]);
        }

        // Fetch requirements and insert into sales_order_bom
        // 1. Paper needs
        const [paperNeeds] = await pool.execute(`
            SELECT qid.paper_id AS inventory_item_id,
                   ii.name AS item_name,
                   SUM(qid.full_sheets_used) AS qty_needed
            FROM quotation_item_details qid
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN inventory_items ii ON ii.id = qid.paper_id
            WHERE qli.quotation_id = ?
              AND qid.paper_id IS NOT NULL
              AND qid.full_sheets_used > 0
            GROUP BY qid.paper_id, ii.name
        `, [quotation_id]);

        // 2. Plate needs
        const [plateNeeds] = await pool.execute(`
            SELECT m.plate_id AS inventory_item_id,
                   ii.name AS item_name,
                   SUM(qid.plate_count) AS qty_needed
            FROM quotation_item_details qid
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN machines m ON m.id = qid.machine_id
            JOIN inventory_items ii ON ii.id = m.plate_id
            WHERE qli.quotation_id = ?
              AND qid.plate_count > 0
              AND m.plate_id IS NOT NULL
            GROUP BY m.plate_id, ii.name
        `, [quotation_id]);

        // 3. SFG needs
        const [sfgNeeds] = await pool.execute(`
            SELECT sl.inventory_item_id,
                   ii.name AS item_name,
                   SUM(sl.quantity) AS qty_needed
            FROM quotation_item_sfg_lines sl
            JOIN quotation_item_details qid ON qid.id = sl.quotation_item_detail_id
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN inventory_items ii ON ii.id = sl.inventory_item_id
            WHERE qli.quotation_id = ?
              AND sl.is_statics = 0
            GROUP BY sl.inventory_item_id, ii.name
        `, [quotation_id]);

        // 4. Statics needs
        const [staticsNeeds] = await pool.execute(`
            SELECT sl.inventory_item_id,
                   ii.name AS item_name,
                   SUM(sl.quantity) AS qty_needed
            FROM quotation_item_sfg_lines sl
            JOIN quotation_item_details qid ON qid.id = sl.quotation_item_detail_id
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN inventory_items ii ON ii.id = sl.inventory_item_id
            WHERE qli.quotation_id = ?
              AND sl.is_statics = 1
            GROUP BY sl.inventory_item_id, ii.name
        `, [quotation_id]);

        const bomItems = [];
        for (const row of paperNeeds) {
            bomItems.push({ inventory_item_id: row.inventory_item_id, component_type: 'paper', component_name: row.item_name, required_qty: Math.ceil(parseFloat(row.qty_needed)) });
        }
        for (const row of plateNeeds) {
            bomItems.push({ inventory_item_id: row.inventory_item_id, component_type: 'plate', component_name: row.item_name, required_qty: Math.ceil(parseFloat(row.qty_needed)) });
        }
        for (const row of sfgNeeds) {
            bomItems.push({ inventory_item_id: row.inventory_item_id, component_type: 'sfg', component_name: row.item_name, required_qty: parseFloat(row.qty_needed) || 0 });
        }
        for (const row of staticsNeeds) {
            bomItems.push({ inventory_item_id: row.inventory_item_id, component_type: 'statics', component_name: row.item_name, required_qty: parseFloat(row.qty_needed) || 0 });
        }

        // Insert into sales_order_bom. Since this is an old order, default to fully issued
        for (const item of bomItems) {
            await pool.execute(
                `INSERT INTO sales_order_bom (sales_order_id, inventory_item_id, component_type, component_name, required_qty, issued_qty)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, item.inventory_item_id, item.component_type, item.component_name, item.required_qty, item.required_qty]
            );
        }

        // Query again to return correct structure
        const [newBomLines] = await pool.execute(`
            SELECT sob.*, ii.item_code, ii.uom, ii.stock_quantity AS available_qty
            FROM sales_order_bom sob
            JOIN inventory_items ii ON sob.inventory_item_id = ii.id
            WHERE sob.sales_order_id = ?
        `, [id]);

        return NextResponse.json(newBomLines);

    } catch (error) {
        console.error("GET Sales Order BOM Error:", error);
        return NextResponse.json({ error: 'Failed to fetch BOM' }, { status: 500 });
    }
}
