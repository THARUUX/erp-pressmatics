import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const { items } = body; // array of { name, category, type, uom, unit_cost, stock_quantity, min_stock, width_cm, height_cm }

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 });
        }

        // Fetch settings for item code generation
        const [settingsRows] = await pool.execute(
            "SELECT * FROM settings WHERE setting_key IN ('item_code_template', 'next_item_code_seq')"
        );
        const settings = {};
        settingsRows.forEach(r => settings[r.setting_key] = r.setting_value);
        const template = settings.item_code_template || 'INV-{0000}';
        let seq = parseInt(settings.next_item_code_seq || '1');

        const results = [];
        const errors = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const rowNum = i + 2; // 1-indexed + header row

            if (!item.name || !item.category) {
                errors.push({ row: rowNum, error: 'Name and Category are required', name: item.name || '(blank)' });
                continue;
            }

            // Generate item code
            let item_code = item.item_code?.trim();
            if (!item_code) {
                let attempts = 0;
                let isUnique = false;
                while (!isUnique && attempts < 100) {
                    const padded = String(seq).padStart(4, '0');
                    item_code = template
                        .replace('{0000}', padded)
                        .replace('{SEQ}', seq)
                        .replace('{CAT}', (item.category || 'INV').substring(0, 3).toUpperCase());
                    const [existing] = await pool.execute('SELECT id FROM inventory_items WHERE item_code = ?', [item_code]);
                    if (existing.length === 0) isUnique = true;
                    seq++;
                    attempts++;
                }
                if (!item_code) {
                    errors.push({ row: rowNum, error: 'Failed to generate item code', name: item.name });
                    continue;
                }
            }

            try {
                const [result] = await pool.execute(
                    'INSERT INTO inventory_items (name, category, type, unit_cost, stock_quantity, item_code, uom, min_stock, is_active, width_cm, height_cm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
                    [
                        item.name.trim(),
                        item.category.trim(),
                        item.type?.trim() || '',
                        parseFloat(item.unit_cost) || 0,
                        parseFloat(item.stock_quantity) || 0,
                        item_code,
                        item.uom?.trim() || 'Unit',
                        parseFloat(item.min_stock) || 0,
                        parseFloat(item.width_cm) || null,
                        parseFloat(item.height_cm) || null,
                    ]
                );
                results.push({ row: rowNum, id: result.insertId, item_code, name: item.name });
            } catch (e) {
                errors.push({ row: rowNum, error: e.message, name: item.name });
            }
        }

        // Persist updated seq
        await pool.execute(
            "UPDATE settings SET setting_value = ? WHERE setting_key = 'next_item_code_seq'",
            [seq]
        );

        return NextResponse.json({
            inserted: results.length,
            errors: errors.length,
            results,
            errorDetails: errors,
        });
    } catch (error) {
        console.error('Bulk upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const deleted = [];
        const failed = [];

        for (const id of ids) {
            try {
                const [result] = await pool.execute('DELETE FROM inventory_items WHERE id = ?', [id]);
                if (result.affectedRows > 0) {
                    deleted.push(id);
                } else {
                    failed.push({ id, error: 'Item not found' });
                }
            } catch (err) {
                let errorMsg = 'Failed to delete item';
                if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                    errorMsg = 'Item is in use';
                }
                failed.push({ id, error: errorMsg });
            }
        }

        return NextResponse.json({ deleted: deleted.length, failed });
    } catch (error) {
        console.error('Bulk inventory delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
