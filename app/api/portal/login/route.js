import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * POST /api/portal/login
 * Body: { email, password }
 * Looks up customer by email, checks if password is set, verifies it if sent,
 * auto-creates portal token if missing, returns { url: '/portal/[token]' }
 */
export async function POST(req) {
    try {
        if (process.env.LICENSE_STATUS === 'inactive') {
            return NextResponse.json({ error: 'Server suspended due to the payment' }, { status: 403 });
        }
        const { email, password } = await req.json();
        if (!email?.trim()) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const [[customer]] = await pool.execute(
            'SELECT id, name, email, portal_token, portal_password FROM customers WHERE email = ? LIMIT 1',
            [email.trim().toLowerCase()]
        );

        if (!customer) {
            return NextResponse.json({ error: 'No account found with that email address.' }, { status: 404 });
        }

        // If customer has a password set
        if (customer.portal_password) {
            if (!password) {
                return NextResponse.json({ passwordRequired: true });
            }
            const isMatch = await bcrypt.compare(password, customer.portal_password);
            if (!isMatch) {
                return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
            }
        }

        // Auto-generate token if none exists
        let token = customer.portal_token;
        if (!token) {
            const crypto = await import('crypto');
            token = crypto.randomBytes(32).toString('hex');
            await pool.execute('UPDATE customers SET portal_token = ? WHERE id = ?', [token, customer.id]);
        }

        return NextResponse.json({ url: `/portal/${token}`, name: customer.name });
    } catch (err) {
        console.error('[portal/login POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
