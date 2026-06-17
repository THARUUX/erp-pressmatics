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

        // Fetch paginated data
        const [rows] = await pool.execute(`SELECT * FROM quotations ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);

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
