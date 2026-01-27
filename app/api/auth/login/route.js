import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const isValid = await comparePassword(password, user.password);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const token = signToken({ id: user.id, email: user.email, role: user.role });

        const cookieStore = await cookies();
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 86400, // 1 day
            path: '/',
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
