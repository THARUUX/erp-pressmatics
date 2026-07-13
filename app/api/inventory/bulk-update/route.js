import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * PUT /api/inventory/bulk-update
 * Body: { rows: [{id, name, type, stock_quantity, unit_cost, min_stock, uom, description, is_active}] }
 * Note: stock_quantity is now included.
 */
export async function PUT(req) {
    try {
        const { rows } = await req.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
        }

        const updated = [];
        const skipped = [];
        const failed  = [];

        for (const row of rows) {
            const id = parseInt(row.id);
            if (!id || isNaN(id)) {
                skipped.push({ id: row.id, reason: 'Missing or invalid id' });
                continue;
            }
            if (!row.name?.trim()) {
                skipped.push({ id, reason: 'Name is required' });
                continue;
            }
            if (!row.item_code?.trim()) {
                skipped.push({ id, reason: 'Item code is required' });
                continue;
            }
            try {
                const [result] = await pool.execute(
                    `UPDATE inventory_items SET
                        item_code=?, name=?, type=?, width_cm=?, height_cm=?, stock_quantity=?, unit_cost=?, min_stock=?,
                        uom=?, description=?, is_active=?
                     WHERE id=?`,
                    [
                        row.item_code.trim(),
                        row.name.trim(),
                        row.type?.trim() || '',
                        row.width_cm !== undefined && row.width_cm !== '' && row.width_cm !== null ? parseFloat(row.width_cm) : null,
                        row.height_cm !== undefined && row.height_cm !== '' && row.height_cm !== null ? parseFloat(row.height_cm) : null,
                        parseFloat(row.stock_quantity) || 0,
                        parseFloat(row.unit_cost) || 0,
                        parseInt(row.min_stock) || 0,
                        row.uom?.trim() || 'Unit',
                        row.description?.trim() || null,
                        row.is_active !== undefined ? (row.is_active ? 1 : 0) : 1,
                        id,
                    ]
                );
                if (result.affectedRows > 0) updated.push(id);
                else skipped.push({ id, reason: 'Item not found' });
            } catch (err) {
                failed.push({ id, error: err.message });
            }
        }

        return NextResponse.json({ updated: updated.length, skipped, failed });
    } catch (error) {
        console.error('Bulk update inventory error:', error);
        return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
    }
}
