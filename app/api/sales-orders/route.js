import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query = `SELECT so.*,
            (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
             FROM quotation_items qi
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             WHERE qli.quotation_id = so.quotation_id) AS estimation_names
        FROM sales_orders so WHERE 1=1`;
        const params = [];

        if (search) {
            query += ' AND (so.code LIKE ? OR so.customer_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status) {
            if (status !== 'All') {
                query += ' AND so.status = ?';
                params.push(status);
            }
        }

        query += ` ORDER BY so.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await pool.execute(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM sales_orders WHERE 1=1';
        const countParams = [];
        if (search) {
            countQuery += ' AND (code LIKE ? OR customer_name LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }
        if (status && status !== 'All') {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }

        const [countResult] = await pool.execute(countQuery, countParams);
        const total = countResult[0].total;

        // Query global stats for sales orders
        const [[stats]] = await pool.execute(`
            SELECT
                COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending_count,
                SUM(CASE WHEN status IN ('In Production') THEN 1 END) AS production_count,
                SUM(CASE WHEN status = 'Pending' THEN total_amount ELSE 0 END) AS pending_total
            FROM sales_orders
        `);

        return NextResponse.json({ salesOrders: rows, total, stats });
    } catch (error) {
        console.error("Fetch Sales Orders Error:", error);
        return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 });
    }
}

export async function POST(req) {
    const conn = await pool.getConnection();
    try {
        const body = await req.json();
        const { quotation_id, auto_deduct_stock = false } = body;

        if (!quotation_id) {
            conn.release();
            return NextResponse.json({ error: 'Quotation ID required' }, { status: 400 });
        }

        // Fetch Quotation Details
        const [quotations] = await conn.execute('SELECT * FROM quotations WHERE id = ?', [quotation_id]);
        if (quotations.length === 0) {
            conn.release();
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }

        const q = quotations[0];

        // Ensure not already converted
        const [existing] = await conn.execute('SELECT id FROM sales_orders WHERE quotation_id = ?', [quotation_id]);
        if (existing.length > 0) {
            conn.release();
            return NextResponse.json({ error: 'Sales order already exists for this quotation' }, { status: 400 });
        }

        // ── FETCH BOM REQUIREMENTS ──────────────────────────────────────────
        // 1. Paper needs
        const [paperNeeds] = await conn.execute(`
            SELECT qid.paper_id AS inventory_item_id,
                   ii.name AS item_name,
                   SUM(qid.full_sheets_used) AS qty_needed,
                   ii.stock_quantity AS available
            FROM quotation_item_details qid
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN inventory_items ii ON ii.id = qid.paper_id
            WHERE qli.quotation_id = ?
              AND qid.paper_id IS NOT NULL
              AND qid.full_sheets_used > 0
            GROUP BY qid.paper_id, ii.name, ii.stock_quantity
        `, [quotation_id]);

        // 2. Plate needs
        const [plateNeeds] = await conn.execute(`
            SELECT m.plate_id AS inventory_item_id,
                   ii.name AS item_name,
                   SUM(qid.plate_count) AS qty_needed,
                   ii.stock_quantity AS available
            FROM quotation_item_details qid
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN machines m ON m.id = qid.machine_id
            JOIN inventory_items ii ON ii.id = m.plate_id
            WHERE qli.quotation_id = ?
              AND qid.plate_count > 0
              AND m.plate_id IS NOT NULL
            GROUP BY m.plate_id, ii.name, ii.stock_quantity
        `, [quotation_id]);

        // 3. SFG needs
        const [sfgNeeds] = await conn.execute(`
            SELECT sl.inventory_item_id,
                   ii.name AS item_name,
                   SUM(sl.quantity) AS qty_needed,
                   ii.stock_quantity AS available
            FROM quotation_item_sfg_lines sl
            JOIN quotation_item_details qid ON qid.id = sl.quotation_item_detail_id
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN inventory_items ii ON ii.id = sl.inventory_item_id
            WHERE qli.quotation_id = ?
              AND sl.is_statics = 0
            GROUP BY sl.inventory_item_id, ii.name, ii.stock_quantity
        `, [quotation_id]);

        // 4. Statics needs
        const [staticsNeeds] = await conn.execute(`
            SELECT sl.inventory_item_id,
                   ii.name AS item_name,
                   SUM(sl.quantity) AS qty_needed,
                   ii.stock_quantity AS available
            FROM quotation_item_sfg_lines sl
            JOIN quotation_item_details qid ON qid.id = sl.quotation_item_detail_id
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            JOIN inventory_items ii ON ii.id = sl.inventory_item_id
            WHERE qli.quotation_id = ?
              AND sl.is_statics = 1
            GROUP BY sl.inventory_item_id, ii.name, ii.stock_quantity
        `, [quotation_id]);

        // Build list of all BOM requirements
        const bomItems = [];
        
        for (const row of paperNeeds) {
            bomItems.push({
                inventory_item_id: row.inventory_item_id,
                component_type: 'paper',
                component_name: row.item_name,
                required_qty: Math.ceil(parseFloat(row.qty_needed)),
                available: parseFloat(row.available || 0)
            });
        }
        for (const row of plateNeeds) {
            bomItems.push({
                inventory_item_id: row.inventory_item_id,
                component_type: 'plate',
                component_name: row.item_name,
                required_qty: Math.ceil(parseFloat(row.qty_needed)),
                available: parseFloat(row.available || 0)
            });
        }
        for (const row of sfgNeeds) {
            bomItems.push({
                inventory_item_id: row.inventory_item_id,
                component_type: 'sfg',
                component_name: row.item_name,
                required_qty: parseFloat(row.qty_needed) || 0,
                available: parseFloat(row.available || 0)
            });
        }
        for (const row of staticsNeeds) {
            bomItems.push({
                inventory_item_id: row.inventory_item_id,
                component_type: 'statics',
                component_name: row.item_name,
                required_qty: parseFloat(row.qty_needed) || 0,
                available: parseFloat(row.available || 0)
            });
        }

        // ── VALIDATION (RUNS FOR ALL CASES) ───────────────────
        const shortages = [];
        for (const item of bomItems) {
            if (item.required_qty > item.available) {
                shortages.push({
                    type: item.component_type,
                    name: item.component_name,
                    required: item.required_qty,
                    available: item.available,
                    shortfall: item.required_qty - item.available
                });
            }
        }
        if (shortages.length > 0) {
            conn.release();
            return NextResponse.json({
                error: 'insufficient_stock',
                message: 'Cannot convert: insufficient stock for some items',
                shortages,
            }, { status: 422 });
        }

        // Begin transaction
        await conn.beginTransaction();

        // Generate SO Code
        const [settings] = await conn.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('so_id_template', 'so_id_seq')");
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let seq = parseInt(settingsMap['so_id_seq'] || '1');
        let template = settingsMap['so_id_template'] || 'SO-{0000}';
        const code = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // Insert into Sales Orders
        const [result] = await conn.execute(
            `INSERT INTO sales_orders (code, quotation_id, customer_id, customer_name, order_date, status, total_amount, auto_deduct_stock) 
             VALUES (?, ?, ?, ?, NOW(), 'Pending', ?, ?)`,
            [code, q.id, q.customer_id, q.customer_name, q.total_amount, auto_deduct_stock ? 1 : 0]
        );

        const soId = result.insertId;

        // Update Quotation Status to 'converted'
        await conn.execute(
            "UPDATE quotations SET status = 'converted' WHERE id = ?",
            [quotation_id]
        );

        // Update Setting seq safely
        await conn.execute(
            "INSERT INTO settings (setting_key, setting_value) VALUES ('so_id_seq', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [String(seq + 1), String(seq + 1)]
        );

        // ── INSERT BOM ITEMS AND OPTIONAL STOCK DEDUCTION ───────────────────
        for (const item of bomItems) {
            const issuedQty = auto_deduct_stock ? item.required_qty : 0;

            // Insert into sales_order_bom
            await conn.execute(
                `INSERT INTO sales_order_bom (sales_order_id, inventory_item_id, component_type, component_name, required_qty, issued_qty)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [soId, item.inventory_item_id, item.component_type, item.component_name, item.required_qty, issuedQty]
            );

            if (auto_deduct_stock && item.required_qty > 0) {
                // Deduct stock in inventory
                await conn.execute(
                    `UPDATE inventory_items
                     SET stock_quantity = GREATEST(0, stock_quantity - ?)
                     WHERE id = ?`,
                    [item.required_qty, item.inventory_item_id]
                );

                // Log in inventory_transactions
                await conn.execute(
                    `INSERT INTO inventory_transactions (inventory_item_id, type, quantity, notes)
                     VALUES (?, 'issue_note', ?, ?)`,
                    [
                        item.inventory_item_id,
                        -item.required_qty,
                        `BOM Auto-Deduct: ${item.component_name} (${item.component_type}) for Sales Order ${code} (${q.customer_name || 'N/A'})`
                    ]
                );
            }
        }

        // Fetch customer details for WhatsApp
        let phone = null;
        let token = null;
        if (q.customer_id) {
            const [custRows] = await conn.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE id = ?', [q.customer_id]);
            if (custRows.length > 0) {
                phone = custRows[0].phone || custRows[0].contact_phone;
                token = custRows[0].portal_token;
            }
        }
        if (!phone && q.customer_name) {
            const [custRows] = await conn.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE name = ?', [q.customer_name]);
            if (custRows.length > 0) {
                phone = custRows[0].phone || custRows[0].contact_phone;
                token = custRows[0].portal_token;
            }
        }

        const [waSettingsRows] = await conn.execute(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('whatsapp_enabled', 'whatsapp_auto_send_order', 'whatsapp_template_order')"
        );
        const waSettings = waSettingsRows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        await conn.commit();
        conn.release();

        if (phone && waSettings['whatsapp_enabled'] === 'true' && waSettings['whatsapp_auto_send_order'] === 'true') {
            const origin = req.headers.get('origin') || 'http://localhost:3000';
            const portalLink = token ? `${origin}/portal/${token}` : '';
            const templateText = waSettings['whatsapp_template_order'] || 'Hello {customer_name}, your order {order_code} has been successfully created. View status: {portal_link}';
            
            const message = templateText
                .replace(/{customer_name}/g, q.customer_name || '')
                .replace(/{order_code}/g, code || '')
                .replace(/{portal_link}/g, portalLink || '')
                .replace(/{order_status}/g, 'Pending')
                .replace(/{delivery_date}/g, '');

            fetch(`${process.env.WHATSAPP_DAEMON_URL || 'http://localhost:5001'}/api/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: phone, message })
            }).catch(err => {
                console.error('Background WhatsApp send error:', err);
            });
        }

        return NextResponse.json({
            success: true,
            salesOrderId: soId,
            autoDeducted: auto_deduct_stock,
            bomCount: bomItems.length
        });

    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error("Create Sales Order Error:", error);
        return NextResponse.json({ error: 'Failed to create sales order', details: error.message }, { status: 500 });
    }
}
