import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const search   = searchParams.get('search') || '';
        const active   = searchParams.get('active');

        let query = 'SELECT * FROM suppliers WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND (name LIKE ? OR code LIKE ? OR email LIKE ? OR phone LIKE ? OR contact_name LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }
        if (active !== null && active !== undefined && active !== '') {
            query += ' AND is_active = ?';
            params.push(parseInt(active));
        }
        query += ' ORDER BY name ASC';

        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('GET /api/suppliers error:', err);
        return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            name, email, phone, address,
            contact_name, contact_phone, contact_email,
            payment_terms, credit_limit, notes,
        } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        // Auto-generate code
        const [seqRows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'supplier_id_seq'"
        );
        let seq = seqRows.length > 0 ? parseInt(seqRows[0].setting_value || '1') : 1;
        const code = `SUP-${String(seq).padStart(3, '0')}`;

        const [result] = await pool.execute(
            `INSERT INTO suppliers
                (name, code, email, phone, address, contact_name, contact_phone, contact_email, payment_terms, credit_limit, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, code,
                email || null, phone || null, address || null,
                contact_name || null, contact_phone || null, contact_email || null,
                payment_terms || 'Net 30',
                parseFloat(credit_limit) || 0,
                notes || null,
            ]
        );

        // Update or insert sequence
        if (seqRows.length > 0) {
            await pool.execute(
                "UPDATE settings SET setting_value = ? WHERE setting_key = 'supplier_id_seq'",
                [String(seq + 1)]
            );
        } else {
            await pool.execute(
                "INSERT INTO settings (setting_key, setting_value) VALUES ('supplier_id_seq', '2')"
            );
        }

        return NextResponse.json({ success: true, id: result.insertId, code });
    } catch (err) {
        console.error('POST /api/suppliers error:', err);
        return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
    }
}
