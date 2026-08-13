import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const isFavorite = searchParams.get('is_favorite');
        const customerId = searchParams.get('customer_id');

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let query = `
            SELECT id, code, customer_name, customer_id, estimation_name, job_description, type, quantity, total_amount, status, created_at, is_favorite 
            FROM quotation_items 
            WHERE (type IS NULL OR type != 'services') 
              AND NOT EXISTS (
                  SELECT 1 FROM quotation_line_items qli 
                  JOIN quotations q ON qli.quotation_id = q.id 
                  WHERE qli.quotation_item_id = quotation_items.id 
                    AND q.service_id IS NOT NULL
              )
        `;
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM quotation_items 
            WHERE (type IS NULL OR type != 'services') 
              AND NOT EXISTS (
                  SELECT 1 FROM quotation_line_items qli 
                  JOIN quotations q ON qli.quotation_id = q.id 
                  WHERE qli.quotation_item_id = quotation_items.id 
                    AND q.service_id IS NOT NULL
              )
        `;

        const params = [];
        const countParams = [];

        const typeParam = searchParams.get('type');

        if (isFavorite === 'true') {
            const condition = ` AND is_favorite = 1`;
            query += condition;
            countQuery += condition;
        }

        if (typeParam === 'digital') {
            const condition = ` AND (type = 'digital' OR id IN (SELECT quotation_item_id FROM quotation_item_details WHERE type = 'digital'))`;
            query += condition;
            countQuery += condition;
        } else if (typeParam === 'offset') {
            const condition = ` AND (type = 'offset' OR type IS NULL OR type NOT IN ('digital', 'services'))`;
            query += condition;
            countQuery += condition;
        }

        if (customerId) {
            const condition = ` AND customer_id = ?`;
            query += condition;
            params.push(customerId);
            countQuery += condition;
            countParams.push(customerId);
        }

        if (search) {
            const condition = ` AND (customer_name LIKE ? OR job_description LIKE ?)`;
            query += condition;
            params.push(`%${search}%`, `%${search}%`);
            countQuery += condition;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const [countRows] = await pool.execute(countQuery, countParams);
        const total = countRows[0].total;

        const [rows] = await pool.execute(query, params);

        return NextResponse.json({
            items: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[/api/items GET]', error?.message || error);
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }
}
