import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';

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
            const merged = { ...DEFAULT_ROLE_PERMISSIONS };
            
            Object.keys(permissions).forEach(role => {
                merged[role] = {
                    ...(DEFAULT_ROLE_PERMISSIONS[role] || {
                        view_dashboard: false,
                        manage_users: false,
                        manage_settings: false,
                        manage_quotations: false,
                        manage_invoices: false,
                        manage_production: false
                    }),
                    ...permissions[role]
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
