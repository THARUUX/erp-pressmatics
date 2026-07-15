import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/whatsapp/messages
 * Query params:
 *   ?search=xyz   → matches sender_name, chat_id, message_body
 *   ?limit=50     → defaults to 50, max 200
 */
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search');
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);

        const conditions = [];
        const params = [];

        if (search) {
            conditions.push('(chat_id LIKE ? OR sender_name LIKE ? OR message_body LIKE ?)');
            const wild = `%${search}%`;
            params.push(wild, wild, wild);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.execute(
            `SELECT * FROM whatsapp_messages ${where} ORDER BY sent_at DESC LIMIT ${limit}`,
            params
        );

        return NextResponse.json({ messages: rows });
    } catch (err) {
        console.error('[WA Messages GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
