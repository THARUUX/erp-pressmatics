import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getRolePermissions } from '@/lib/permissions';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const [rows] = await pool.execute(
            'SELECT id, name, email, role, is_banned FROM users WHERE id = ?',
            [decoded.id]
        );

        const user = rows[0];
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.is_banned) {
            return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
        }

        let companyName = 'Pressmatics';
        try {
            const [settingsRows] = await pool.execute(
                "SELECT setting_value FROM settings WHERE setting_key = 'company_name' LIMIT 1"
            );
            if (settingsRows.length > 0 && settingsRows[0].setting_value) {
                companyName = settingsRows[0].setting_value;
            }
        } catch (e) {
            console.error('Failed to fetch active company name in /api/auth/me:', e.message);
        }

        const permissions = await getRolePermissions(user.role);

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions,
            companyName: companyName
        });

    } catch (error) {
        console.error('Me endpoint error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
