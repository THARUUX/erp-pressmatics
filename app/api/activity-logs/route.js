import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const entity_type = searchParams.get('entity_type') || '';
        const entity_id = searchParams.get('entity_id') || '';
        const action = searchParams.get('action') || '';
        const search = searchParams.get('search') || '';

        let query = 'SELECT * FROM activity_logs WHERE 1=1';
        const params = [];

        if (entity_type) {
            query += ' AND entity_type = ?';
            params.push(entity_type);
        }
        if (entity_id) {
            query += ' AND entity_id = ?';
            params.push(entity_id);
        }
        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }
        if (search) {
            query += ' AND (username LIKE ? OR details LIKE ? OR entity_id LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        query += ` ORDER BY created_at DESC LIMIT ${limit}`;

        const [rows] = await pool.execute(query, params);

        return NextResponse.json({ logs: rows });
    } catch (err) {
        console.error('Fetch activity logs error:', err);
        return NextResponse.json({ error: 'Failed to fetch activity logs', details: err.message }, { status: 500 });
    }
}
