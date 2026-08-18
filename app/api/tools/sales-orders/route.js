import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        let query = `
            SELECT 
                so.id, 
                so.code, 
                so.customer_name, 
                so.status, 
                so.created_at,
                c.phone AS customer_phone,
                c.contact_phone AS customer_contact_phone,
                c.address AS customer_address,
                COALESCE(
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id),
                    (SELECT GROUP_CONCAT(DISTINCT jt.name SEPARATOR ' · ') FROM job_tasks jt WHERE jt.sales_order_id = so.id),
                    'Printed Item'
                ) AS estimation_names
            FROM sales_orders so
            LEFT JOIN customers c ON (so.customer_id IS NOT NULL AND c.id = so.customer_id) OR (so.customer_id IS NULL AND c.name = so.customer_name)
            WHERE so.status NOT IN ('cancelled', 'draft')
        `;
        const params = [];

        if (search) {
            const q = `%${search}%`;
            query += ` AND (
                so.code LIKE ? OR 
                so.customer_name LIKE ? OR 
                so.job_notes LIKE ? OR
                c.phone LIKE ? OR
                c.contact_phone LIKE ? OR
                EXISTS (
                    SELECT 1 FROM quotation_line_items qli
                    JOIN quotation_items qi ON qli.quotation_item_id = qi.id
                    WHERE qli.quotation_id = so.quotation_id AND qi.estimation_name LIKE ?
                ) OR
                EXISTS (
                    SELECT 1 FROM job_tasks jt
                    WHERE jt.sales_order_id = so.id AND (jt.name LIKE ? OR jt.description LIKE ?)
                )
            )`;
            params.push(q, q, q, q, q, q, q, q);
        }

        query += ` ORDER BY so.id DESC LIMIT 50`;

        const [orders] = await pool.execute(query, params);

        return NextResponse.json({
            success: true,
            orders,
        });
    } catch (error) {
        console.error('Fetch Tools Sales Orders Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sales orders' }, { status: 500 });
    }
}
