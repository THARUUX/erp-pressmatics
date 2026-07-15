import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * PATCH /api/whatsapp/notifications/[id]
 * Updates read status. Can accept a body JSON: { is_read: true/false }
 */
export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        let isRead = 1;
        try {
            const body = await req.json();
            if (body && typeof body.is_read !== 'undefined') {
                isRead = body.is_read ? 1 : 0;
            }
        } catch {}

        await pool.execute(
            'UPDATE whatsapp_notifications SET is_read = ? WHERE id = ?',
            [isRead, id]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/whatsapp/notifications/[id]
 * Deletes a notification from the database.
 */
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute(
            'DELETE FROM whatsapp_notifications WHERE id = ?',
            [id]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
