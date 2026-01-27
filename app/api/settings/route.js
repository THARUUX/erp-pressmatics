import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute('SELECT * FROM settings');
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        return NextResponse.json(settings);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { key, value } = body;

        await pool.execute(
            `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [key, value, value]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
    }
}
