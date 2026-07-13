import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch detailed transactions for employee
        const [rows] = await pool.execute(`
            SELECT esa.*,
                   ii.name AS item_name,
                   ii.item_code AS item_code,
                   ii.category AS item_category,
                   ii.uom AS item_uom,
                   so.code AS so_code,
                   so.customer_name AS so_customer,
                   t.name AS team_name
            FROM employee_stock_actions esa
            JOIN inventory_items ii ON esa.inventory_item_id = ii.id
            LEFT JOIN sales_orders so ON esa.sales_order_id = so.id
            LEFT JOIN teams t ON esa.team_id = t.id
            WHERE esa.employee_id = ?
            ORDER BY esa.created_at DESC
        `, [id]);

        // Calculate summary aggregates
        const [[summary]] = await pool.execute(`
            SELECT
                COALESCE(SUM(CASE WHEN action_type = 'saved' THEN quantity ELSE 0 END), 0) AS total_saved_qty,
                COALESCE(SUM(CASE WHEN action_type = 'saved' THEN quantity * unit_cost ELSE 0 END), 0) AS total_saved_value,
                COALESCE(SUM(CASE WHEN action_type = 'wasted' THEN quantity ELSE 0 END), 0) AS total_wasted_qty,
                COALESCE(SUM(CASE WHEN action_type = 'wasted' THEN quantity * unit_cost ELSE 0 END), 0) AS total_wasted_value
            FROM employee_stock_actions
            WHERE employee_id = ?
        `, [id]);

        return NextResponse.json({
            actions: rows,
            summary: {
                totalSavedQty: parseFloat(summary.total_saved_qty),
                totalSavedValue: parseFloat(summary.total_saved_value),
                totalWastedQty: parseFloat(summary.total_wasted_qty),
                totalWastedValue: parseFloat(summary.total_wasted_value)
            }
        });
    } catch (error) {
        console.error("Fetch Employee Stock Actions Error:", error);
        return NextResponse.json({ error: "Failed to fetch employee stock actions" }, { status: 500 });
    }
}
