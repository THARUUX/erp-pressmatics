import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * PATCH /api/whatsapp/notifications/[id]
 * Marks a notification as read.
 */
export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute(
            'UPDATE whatsapp_notifications SET is_read = 1 WHERE id = ?',
            [id]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
