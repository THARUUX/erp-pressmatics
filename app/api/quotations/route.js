import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const offset = (page - 1) * limit;

        // Get total count for pagination metadata
        const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM quotations');
        const total = countResult[0].total;

        const [rows] = await pool.execute(`
            SELECT q.*,
                EXISTS(SELECT 1 FROM invoices WHERE quotation_id = q.id) AS has_invoice,
                (SELECT qi.estimation_name
                 FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = q.id
                 ORDER BY qli.display_order ASC
                 LIMIT 1) AS first_item_name
            FROM quotations q
            ORDER BY q.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `);

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
        console.error("List Error:", error);
        return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
    }
}
