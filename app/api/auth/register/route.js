import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Check if user exists
        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        const hashedPassword = await hashPassword(password);

        await pool.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        return NextResponse.json({ success: true, message: 'User created successfully' });

    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
