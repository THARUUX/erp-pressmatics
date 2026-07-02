import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/suppliers/bulk
 * Body: { suppliers: [{name, email, phone, address, contact_name, contact_phone, contact_email, payment_terms, credit_limit, notes}] }
 * Returns: { imported: N, failed: [{row, error}] }
 */
export async function POST(req) {
    try {
        const { suppliers } = await req.json();
        if (!Array.isArray(suppliers) || suppliers.length === 0) {
            return NextResponse.json({ error: 'No suppliers provided' }, { status: 400 });
        }

        // Fetch current sequence
        const [seqRows] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'supplier_id_seq'"
        );
        let seq = seqRows.length > 0 ? parseInt(seqRows[0].setting_value || '1') : 1;

        const imported = [];
        const failed   = [];

        for (let i = 0; i < suppliers.length; i++) {
            const s = suppliers[i];
            const name = (s.name || '').trim();
            if (!name) { failed.push({ row: i + 2, error: 'Name is required' }); continue; }

            const code = `SUP-${String(seq).padStart(3, '0')}`;

            try {
                await pool.execute(
                    `INSERT INTO suppliers
                        (name, code, email, phone, address, contact_name, contact_phone, contact_email, payment_terms, credit_limit, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        name, code,
                        (s.email || '').trim() || null,
                        (s.phone || '').trim() || null,
                        (s.address || '').trim() || null,
                        (s.contact_name || '').trim() || null,
                        (s.contact_phone || '').trim() || null,
                        (s.contact_email || '').trim() || null,
                        s.payment_terms || 'Net 30',
                        parseFloat(s.credit_limit) || 0,
                        (s.notes || '').trim() || null,
                    ]
                );
                imported.push(name);
                seq++;
            } catch (err) {
                failed.push({ row: i + 2, error: err.message });
            }
        }

        // Persist new sequence counter
        if (seqRows.length > 0) {
            await pool.execute(
                "UPDATE settings SET setting_value = ? WHERE setting_key = 'supplier_id_seq'",
                [String(seq)]
            );
        } else {
            await pool.execute(
                "INSERT INTO settings (setting_key, setting_value) VALUES ('supplier_id_seq', ?)",
                [String(seq)]
            );
        }

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
                const [result] = await pool.execute('DELETE FROM suppliers WHERE id = ?', [id]);
                if (result.affectedRows > 0) {
                    deleted.push(id);
                } else {
                    failed.push({ id, error: 'Supplier not found' });
                }
            } catch (err) {
                let errorMsg = 'Failed to delete supplier';
                if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                    errorMsg = 'Supplier is referenced by other records';
                }
                failed.push({ id, error: errorMsg });
            }
        }

        return NextResponse.json({ deleted: deleted.length, failed });
    } catch (error) {
        console.error('Bulk supplier delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
