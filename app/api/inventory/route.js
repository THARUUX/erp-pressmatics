import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');

        let query = 'SELECT * FROM inventory_items';
        const params = [];

        if (category) {
            // For SFG, use flexible matching to catch 'SF', 'SFG', 'Semi-Finished', etc.
            // For Assets, also use flexible matching.
            if (category === 'SFG') {
                query += " WHERE (category = 'SFG' OR category = 'SF' OR category LIKE '%SFG%' OR category LIKE '%Semi%' OR category LIKE '%Asset%')";
            } else {
                query += ' WHERE category = ?';
                params.push(category);
            }
        }

        query += ' ORDER BY name ASC';

        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, category, type, unit_cost, stock_quantity, uom } = body;
        let { item_code } = body;

        if (!name || !category) {
            return NextResponse.json({ error: 'Name and Category are required' }, { status: 400 });
        }

        // Auto-generate item code if not provided
        if (!item_code) {
            // Fetch settings
            const [settingsRows] = await pool.execute("SELECT * FROM settings WHERE setting_key IN ('item_code_template', 'next_item_code_seq')");
            const settings = {};
            settingsRows.forEach(r => settings[r.setting_key] = r.setting_value);

            const template = settings.item_code_template || 'INV-{0000}';
            let seq = parseInt(settings.next_item_code_seq || '1');

            let isUnique = false;
            let attempts = 0;

            // Try generating until unique
            while (!isUnique && attempts < 100) {
                const paddedSeq = String(seq).padStart(4, '0');
                item_code = template
                    .replace('{0000}', paddedSeq)
                    .replace('{SEQ}', seq)
                    .replace('{CAT}', category.substring(0, 3).toUpperCase());

                // Check uniqueness specifically for this generated code
                const [existing] = await pool.execute("SELECT id FROM inventory_items WHERE item_code = ?", [item_code]);

                if (existing.length === 0) {
                    isUnique = true;
                }

                seq++; // Prepare next seq
                attempts++;
            }

            if (!isUnique) {
                return NextResponse.json({ error: 'Failed to generate unique item code' }, { status: 500 });
            }

            // Update global sequence 
            await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'next_item_code_seq'", [seq]);
        }

        const [result] = await pool.execute(
            'INSERT INTO inventory_items (name, category, type, unit_cost, stock_quantity, item_code, uom, min_stock, is_active, width_cm, height_cm, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, category, type || '', parseFloat(unit_cost) || 0, parseInt(stock_quantity) || 0, item_code, uom || 'Unit', parseInt(body.min_stock) || 0, 1, parseFloat(body.width_cm) || null, parseFloat(body.height_cm) || null, body.description || null]
        );

        return NextResponse.json({ success: true, id: result.insertId, item_code });
    } catch (error) {
        console.error('Add Inventory Error:', error);
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}
