import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        let query = 'SELECT * FROM customers';
        const params = [];

        if (search) {
            query += ' WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, email, phone, address, is_vat, vat_number } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const [settings] = await pool.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('customer_id_template', 'customer_id_seq')");
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let seq = parseInt(settingsMap['customer_id_seq'] || '1');
        let template = settingsMap['customer_id_template'] || 'CUST-{000}';
        const code = template.replace('{000}', String(seq).padStart(3, '0')).replace('{SEQ}', String(seq));

        const [result] = await pool.execute(
            'INSERT INTO customers (name, email, phone, address, code, is_vat, vat_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email || null, phone || null, address || null, code, is_vat ? 1 : 0, vat_number || null]
        );

        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'customer_id_seq'", [String(seq + 1)]);

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }
}
