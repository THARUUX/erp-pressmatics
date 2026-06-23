import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/estimations/recent — estimations created within the last 30 days
export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT id, estimation_name, job_description, quantity, total_amount, created_at, type
            FROM quotation_items
            WHERE created_at >= NOW() - INTERVAL 30 DAY
            ORDER BY created_at DESC
            LIMIT 100
        `);
        return NextResponse.json(rows);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}
