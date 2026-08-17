import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getRolePermissions } from '@/lib/permissions';

export async function POST(req) {
    try {
        if (process.env.LICENSE_STATUS === 'inactive') {
            return NextResponse.json({ error: 'Server suspended due to the payment' }, { status: 403 });
        }
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        if (user.is_banned === 1) {
            return NextResponse.json({ error: 'Your account has been banned. Please contact the administrator.' }, { status: 403 });
        }

        const isValid = await comparePassword(password, user.password);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const permissions = await getRolePermissions(user.role);
        const token = signToken({ id: user.id, email: user.email, role: user.role, permissions });

        const cookieStore = await cookies();
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 86400, // 7 days (604,800 seconds)
            path: '/',
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions }
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
