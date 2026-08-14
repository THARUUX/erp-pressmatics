import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '1000');
        const page = parseInt(searchParams.get('page') || '1');
        const offset = (page - 1) * limit;
        const category = searchParams.get('category') || searchParams.get('job_type') || '';
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';

        let query = `
            SELECT q.*,
                CASE
                  WHEN q.service_id IS NOT NULL THEN 'services'
                  WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = q.id AND qi.type = 'services') > 0 THEN 'services'
                  WHEN (SELECT COUNT(*) FROM quotation_items qi JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = q.id AND qi.type = 'digital') > 0 THEN 'digital'
                  WHEN (SELECT COUNT(*) FROM quotation_item_details qid JOIN quotation_items qi ON qid.quotation_item_id = qi.id JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id WHERE qli.quotation_id = q.id AND qid.type = 'digital') > 0 THEN 'digital'
                  ELSE 'offset'
                END AS job_type,
                EXISTS(SELECT 1 FROM invoices WHERE quotation_id = q.id) AS has_invoice,
                (SELECT qi.estimation_name
                 FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = q.id
                 ORDER BY qli.display_order ASC
                 LIMIT 1) AS first_item_name
            FROM quotations q
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (q.code LIKE ? OR q.customer_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status && status !== 'All') {
            query += ' AND q.status = ?';
            params.push(status);
        }

        if (category && category.toLowerCase() !== 'all') {
            query += ` HAVING job_type = ?`;
            params.push(category.toLowerCase());
        }

        query += ` ORDER BY q.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await pool.execute(query, params);

        // Get total count
        const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM quotations');
        const total = countResult[0].total;

        return NextResponse.json({
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Fetch Quotations Error:", error);
        return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
    }
}
