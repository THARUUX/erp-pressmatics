import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query');

        if (!query) {
            return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
        }

        const cleanQuery = query.trim();

        // 1. Check if it's a URL (e.g., http://localhost:3000/jobs/12)
        const jobUrlMatch = cleanQuery.match(/\/jobs\/(\d+)/);
        if (jobUrlMatch) {
            const id = parseInt(jobUrlMatch[1]);
            const [rows] = await pool.execute('SELECT id FROM sales_orders WHERE id = ?', [id]);
            if (rows.length > 0) {
                return NextResponse.json({ id: rows[0].id });
            }
        }

        // 2. Check if it's a Sales Order code (e.g. SO-0095)
        if (cleanQuery.toUpperCase().startsWith('SO-')) {
            const [rows] = await pool.execute('SELECT id FROM sales_orders WHERE code = ?', [cleanQuery]);
            if (rows.length > 0) {
                return NextResponse.json({ id: rows[0].id });
            }
            // Try partial or case-insensitive matches
            const [rowsLike] = await pool.execute('SELECT id FROM sales_orders WHERE code LIKE ?', [`%${cleanQuery}%`]);
            if (rowsLike.length > 0) {
                return NextResponse.json({ id: rowsLike[0].id });
            }
        }

        // 3. Check if it's a number (direct ID)
        if (!isNaN(cleanQuery)) {
            const id = parseInt(cleanQuery);
            const [rows] = await pool.execute('SELECT id FROM sales_orders WHERE id = ?', [id]);
            if (rows.length > 0) {
                return NextResponse.json({ id: rows[0].id });
            }
        }

        // 4. Try general search by code or customer name
        const [generalRows] = await pool.execute(
            'SELECT id FROM sales_orders WHERE code LIKE ? OR customer_name LIKE ? LIMIT 1',
            [`%${cleanQuery}%`, `%${cleanQuery}%`]
        );
        if (generalRows.length > 0) {
            return NextResponse.json({ id: generalRows[0].id });
        }

        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    } catch (error) {
        console.error('Resolve job error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
