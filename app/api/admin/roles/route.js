import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const DEFAULT_ROLE_PERMISSIONS = {
    admin: {
        view_dashboard: true,
        manage_users: true,
        manage_settings: true,
        manage_quotations: true,
        manage_invoices: true,
        manage_production: true
    },
    manager: {
        view_dashboard: true,
        manage_users: false,
        manage_settings: false,
        manage_quotations: true,
        manage_invoices: true,
        manage_production: true
    },
    operator: {
        view_dashboard: true,
        manage_users: false,
        manage_settings: false,
        manage_quotations: false,
        manage_invoices: false,
        manage_production: true
    }
};

export async function GET() {
    try {
        const [rows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'role_permissions'"
        );

        if (rows.length === 0) {
            return NextResponse.json(DEFAULT_ROLE_PERMISSIONS);
        }

        try {
            const permissions = JSON.parse(rows[0].setting_value);
            // Merge defaults to handle newly added permission flags seamlessly
            const merged = {};
            Object.keys(DEFAULT_ROLE_PERMISSIONS).forEach(role => {
                merged[role] = {
                    ...DEFAULT_ROLE_PERMISSIONS[role],
                    ...(permissions[role] || {})
                };
            });
            return NextResponse.json(merged);
        } catch {
            return NextResponse.json(DEFAULT_ROLE_PERMISSIONS);
        }
    } catch (error) {
        console.error('Error fetching role permissions:', error);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const permissions = await req.json();

        if (!permissions || typeof permissions !== 'object') {
            return NextResponse.json({ error: 'Invalid permissions payload' }, { status: 400 });
        }

        const valueStr = JSON.stringify(permissions);

        await pool.execute(
            `INSERT INTO settings (setting_key, setting_value) VALUES ('role_permissions', ?) 
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [valueStr, valueStr]
        );

        return NextResponse.json({ success: true, message: 'Role permissions saved successfully' });
    } catch (error) {
        console.error('Error saving role permissions:', error);
        return NextResponse.json({ error: 'Failed to save role permissions' }, { status: 500 });
    }
}
