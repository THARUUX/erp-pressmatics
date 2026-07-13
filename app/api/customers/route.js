import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        let query = `
            SELECT c.id, c.code, c.name, c.email, c.phone, c.address, c.created_at, c.is_vat, c.vat_number, c.contact_name, c.contact_phone, c.contact_email, c.contact_role, c.starting_outstanding, c.category, c.portal_token, (c.portal_password IS NOT NULL) AS has_password,
                (COALESCE(c.starting_outstanding, 0) +
                 COALESCE((SELECT SUM(CASE WHEN i.status != 'paid' THEN i.amount_due - i.amount_paid ELSE 0 END)
                           FROM invoices i
                           WHERE i.customer_id = c.id), 0)) AS outstanding
            FROM customers c
        `;
        const params = [];

        if (search) {
            query += ' WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY c.created_at DESC';

        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (error) {
        console.error('GET /api/customers error:', error);
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, email, phone, address, is_vat, vat_number, contact_name, contact_phone, contact_email, contact_role, starting_outstanding, category, portal_password } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const [settings] = await pool.execute("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('customer_id_template', 'customer_id_seq')");
        const settingsMap = settings.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        let seq = parseInt(settingsMap['customer_id_seq'] || '1');
        let template = settingsMap['customer_id_template'] || 'CUST-{000}';
        const code = template.replace('{000}', String(seq).padStart(3, '0')).replace('{SEQ}', String(seq));

        const passwordHash = (portal_password && portal_password.trim() !== '') 
            ? await bcrypt.hash(portal_password.trim(), 10) 
            : null;

        const [result] = await pool.execute(
            'INSERT INTO customers (name, email, phone, address, code, is_vat, vat_number, contact_name, contact_phone, contact_email, contact_role, starting_outstanding, category, portal_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, email || null, phone || null, address || null, code, is_vat ? 1 : 0, vat_number || null, contact_name || null, contact_phone || null, contact_email || null, contact_role || null, parseFloat(starting_outstanding) || 0, category || null, passwordHash]
        );

        await pool.execute("UPDATE settings SET setting_value = ? WHERE setting_key = 'customer_id_seq'", [String(seq + 1)]);

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('POST /api/customers error:', error);
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }
}
