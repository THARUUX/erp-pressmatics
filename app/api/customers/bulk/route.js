import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/customers/bulk
 * Body: { customers: [{name, email, phone, address, is_vat, vat_number}] }
 * Returns: { imported: N, failed: [{row, error}] }
 */
export async function POST(req) {
    try {
        const { customers } = await req.json();
        if (!Array.isArray(customers) || customers.length === 0) {
            return NextResponse.json({ error: 'No customers provided' }, { status: 400 });
        }

        // Fetch current sequence + template once
        const [settingsRows] = await pool.execute(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('customer_id_template', 'customer_id_seq')"
        );
        const settingsMap = settingsRows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
        let seq    = parseInt(settingsMap['customer_id_seq'] || '1');
        const tmpl = settingsMap['customer_id_template'] || 'CUST-{000}';

        const imported = [];
        const failed   = [];

        for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            const name = (c.name || '').trim();
            if (!name) { failed.push({ row: i + 2, error: 'Name is required' }); continue; }

            const code = tmpl
                .replace('{000}', String(seq).padStart(3, '0'))
                .replace('{SEQ}', String(seq));

            try {
                await pool.execute(
                    'INSERT INTO customers (name, email, phone, address, code, is_vat, vat_number, contact_name, contact_phone, contact_email, contact_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        name,
                        (c.email || '').trim() || null,
                        (c.phone || '').trim() || null,
                        (c.address || '').trim() || null,
                        code,
                        c.is_vat ? 1 : 0,
                        (c.vat_number || '').trim() || null,
                        (c.contact_name || '').trim() || null,
                        (c.contact_phone || '').trim() || null,
                        (c.contact_email || '').trim() || null,
                        (c.contact_role || '').trim() || null,
                    ]
                );
                imported.push(name);
                seq++;
            } catch (err) {
                failed.push({ row: i + 2, error: err.message });
            }
        }

        // Persist new sequence counter
        await pool.execute(
            "UPDATE settings SET setting_value = ? WHERE setting_key = 'customer_id_seq'",
            [String(seq)]
        );

        return NextResponse.json({ imported: imported.length, failed });
    } catch (error) {
        console.error('Bulk import error:', error);
        return NextResponse.json({ error: 'Bulk import failed' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const deleted = [];
        const failed = [];

        for (const id of ids) {
            try {
                const [result] = await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
                if (result.affectedRows > 0) {
                    deleted.push(id);
                } else {
                    failed.push({ id, error: 'Customer not found' });
                }
            } catch (err) {
                let errorMsg = 'Failed to delete customer';
                if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                    errorMsg = 'Customer is referenced by other records';
                }
                failed.push({ id, error: errorMsg });
            }
        }

        return NextResponse.json({ deleted: deleted.length, failed });
    } catch (error) {
        console.error('Bulk customer delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
