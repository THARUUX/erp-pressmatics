import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/inventory/[id]/bom
 * Returns all BOM lines for the given SF/FG inventory item,
 * joined with component name, UoM, unit_cost and current stock.
 */
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute(
            `SELECT
                b.id,
                b.component_item_id,
                b.quantity,
                b.notes,
                i.name        AS component_name,
                i.item_code   AS component_code,
                i.uom         AS component_uom,
                i.unit_cost   AS component_unit_cost,
                i.stock_quantity AS component_stock,
                i.category    AS component_category
            FROM inventory_bom b
            JOIN inventory_items i ON b.component_item_id = i.id
            WHERE b.parent_item_id = ?
            ORDER BY b.id ASC`,
            [id]
        );
        return NextResponse.json(rows);
    } catch (error) {
        console.error('BOM GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch BOM' }, { status: 500 });
    }
}

/**
 * POST /api/inventory/[id]/bom
 * Replaces the BOM for a given item.
 * Body: { lines: [{ component_item_id, quantity, notes }] }
 * Does NOT touch any stock quantities.
 */
export async function POST(req, { params }) {
    const conn = await pool.getConnection();
    try {
        const { id } = await params;
        const { lines = [] } = await req.json();

        await conn.beginTransaction();

        // Delete existing BOM for this parent
        await conn.execute('DELETE FROM inventory_bom WHERE parent_item_id = ?', [id]);

        // Insert new lines
        for (const line of lines) {
            const { component_item_id, quantity, notes } = line;
            if (!component_item_id || !quantity || parseFloat(quantity) <= 0) continue;
            await conn.execute(
                'INSERT INTO inventory_bom (parent_item_id, component_item_id, quantity, notes) VALUES (?, ?, ?, ?)',
                [id, component_item_id, parseFloat(quantity), notes || null]
            );
        }

        await conn.commit();
        return NextResponse.json({ success: true });
    } catch (error) {
        await conn.rollback();
        console.error('BOM POST Error:', error);
        return NextResponse.json({ error: 'Failed to save BOM' }, { status: 500 });
    } finally {
        conn.release();
    }
}
