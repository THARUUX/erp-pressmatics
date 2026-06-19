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

        return NextResponse.json({ salesOrders: rows, total });
    } catch (error) {
        console.error("Fetch Sales Orders Error:", error);
        return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { quotation_id } = body;

        if (!quotation_id) {
            return NextResponse.json({ error: 'Quotation ID required' }, { status: 400 });
        }

        // Fetch Quotation Details
        const [quotations] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [quotation_id]);
        if (quotations.length === 0) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }

        const q = quotations[0];

        // Ensure not already converted
        const [existing] = await pool.execute('SELECT id FROM sales_orders WHERE quotation_id = ?', [quotation_id]);
        if (existing.length > 0) {
            return NextResponse.json({ error: 'Sales order already exists for this quotation' }, { status: 400 });
        }

        // Generate SO Code
        const [settings] = await pool.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('so_id_template', 'so_id_seq')");
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let seq = parseInt(settingsMap['so_id_seq'] || '1');
        let template = settingsMap['so_id_template'] || 'SO-{0000}';
        const code = template.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

        // Insert into Sales Orders
        const [result] = await pool.execute(
            `INSERT INTO sales_orders (code, quotation_id, customer_id, customer_name, order_date, status, total_amount) 
             VALUES (?, ?, ?, ?, NOW(), 'Pending', ?)`,
            [code, q.id, q.customer_id, q.customer_name, q.total_amount]
        );

        const soId = result.insertId;

        // Update Setting seq safely
        await pool.execute(
            "INSERT INTO settings (setting_key, setting_value) VALUES ('so_id_seq', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [String(seq + 1), String(seq + 1)]
        );

        // ── STOCK DEDUCTION ──────────────────────────────────────────────────
        // Fetch all quotation_item_details for items linked to this quotation.
        // For each detail that has a paper_id, deduct full_sheets_used from papers.stock_quantity.
        const [details] = await pool.execute(`
            SELECT qid.paper_id, SUM(qid.full_sheets_used) AS sheets_needed
            FROM quotation_item_details qid
            JOIN quotation_line_items qli ON qli.quotation_item_id = qid.quotation_item_id
            WHERE qli.quotation_id = ?
              AND qid.paper_id IS NOT NULL
              AND qid.full_sheets_used > 0
            GROUP BY qid.paper_id
        `, [quotation_id]); 

        const stockDeductions = [];
        for (const row of details) {
            const sheetsToDeduct = Math.ceil(parseFloat(row.sheets_needed));
            await pool.execute(`
                UPDATE papers
                SET stock_quantity = GREATEST(0, stock_quantity - ?)
                WHERE id = ?
            `, [sheetsToDeduct, row.paper_id]);
            stockDeductions.push({ paper_id: row.paper_id, sheets_deducted: sheetsToDeduct });
        }
        // ─────────────────────────────────────────────────────────────────────

        return NextResponse.json({ success: true, salesOrderId: soId, stockDeductions });

    } catch (error) {
        console.error("Create Sales Order Error:", error);
        return NextResponse.json({ error: 'Failed to create sales order', details: error.message }, { status: 500 });
    }
}
