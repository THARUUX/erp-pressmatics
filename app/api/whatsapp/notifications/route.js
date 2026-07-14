import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/whatsapp/notifications
 * Query params:
 *   ?unread=true   → only unread
 *   ?quotation_id=X → only for a specific quotation
 *   ?limit=20      → max rows (default 50)
 */
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const unreadOnly  = searchParams.get('unread') === 'true';
        const quotationId = searchParams.get('quotation_id');
        // Inline LIMIT — TiDB Cloud rejects LIMIT with a bound ? parameter
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);

        const conditions = [];
        const params = [];

        if (unreadOnly) {
            conditions.push('is_read = 0');
        }
        if (quotationId) {
            conditions.push('quotation_id = ?');
            params.push(quotationId);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.execute(
            `SELECT * FROM whatsapp_notifications ${where} ORDER BY received_at DESC LIMIT ${limit}`,
            params
        );

        // Count unread separately so it's always accurate regardless of filters
        const [unreadRows] = await pool.execute(
            'SELECT COUNT(*) as cnt FROM whatsapp_notifications WHERE is_read = 0'
        );
        const unreadCount = Number(unreadRows[0]?.cnt || 0);

        return NextResponse.json({ notifications: rows, unread_count: unreadCount });
    } catch (err) {
        console.error('[WA Notifications GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';

