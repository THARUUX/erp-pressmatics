import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const query = `
            SELECT 
                ii.id AS inventory_item_id,
                ii.name AS name,
                ii.category AS category,
                ii.type AS type,
                ii.unit_cost AS unit_cost,
                ii.stock_quantity AS stock_quantity,
                ii.min_stock AS min_stock,
                ii.uom AS uom,
                si.id AS supplier_item_id,
                si.supplier_id AS supplier_id,
                si.item_name AS supplier_item_name,
                si.sku AS supplier_sku,
                si.unit_price AS supplier_unit_price,
                si.min_order_qty AS supplier_min_order_qty,
                s.name AS supplier_name,
                s.code AS supplier_code
            FROM inventory_items ii
            LEFT JOIN supplier_items si ON si.inventory_item_id = ii.id AND si.is_active = 1
            LEFT JOIN suppliers s ON s.id = si.supplier_id AND s.is_active = 1
            WHERE ii.is_active = 1 AND ii.stock_quantity < ii.min_stock
            ORDER BY ii.name ASC, si.unit_price ASC
        `;

        const [rows] = await pool.execute(query);

        // Group rows by inventory item so we don't duplicate them, and keep list of available suppliers
        const itemMap = {};
        rows.forEach(row => {
            const itemId = row.inventory_item_id;
            if (!itemMap[itemId]) {
                itemMap[itemId] = {
                    id: itemId,
                    name: row.name,
                    category: row.category,
                    type: row.type,
                    unit_cost: parseFloat(row.unit_cost || 0),
                    stock_quantity: parseFloat(row.stock_quantity || 0),
                    min_stock: parseFloat(row.min_stock || 0),
                    uom: row.uom || 'Unit',
                    suppliers: []
                };
            }
            if (row.supplier_id) {
                itemMap[itemId].suppliers.push({
                    supplier_item_id: row.supplier_item_id,
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name,
                    supplier_code: row.supplier_code,
                    supplier_item_name: row.supplier_item_name,
                    sku: row.supplier_sku,
                    unit_price: parseFloat(row.supplier_unit_price || 0),
                    min_order_qty: parseFloat(row.supplier_min_order_qty || 1)
                });
            }
        });

        return NextResponse.json(Object.values(itemMap));
    } catch (err) {
        console.error('Fetch low stock error:', err);
        return NextResponse.json({ error: 'Failed to fetch low stock items' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
