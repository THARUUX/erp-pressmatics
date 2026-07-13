import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import crypto from 'crypto';

/**
 * POST /api/customers/[id]/portal-token
 * Generates (or regenerates) a secure portal token for the customer.
 * Returns { token, url }
 */
export async function POST(req, { params }) {
    try {
        const { id } = await params;

        // Verify customer exists
        const [[customer]] = await pool.execute(
            'SELECT id FROM customers WHERE id = ?', [id]
        );
        if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');

        await pool.execute(
            'UPDATE customers SET portal_token = ? WHERE id = ?',
            [token, id]
        );

        return NextResponse.json({ token, url: `/portal/${token}` });
    } catch (err) {
        console.error('[portal-token POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * GET /api/customers/[id]/portal-token
 * Returns existing token (or null). Used to check if one already exists.
 */
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [[customer]] = await pool.execute(
            'SELECT portal_token FROM customers WHERE id = ?', [id]
        );
        if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ token: customer.portal_token, url: customer.portal_token ? `/portal/${customer.portal_token}` : null });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
