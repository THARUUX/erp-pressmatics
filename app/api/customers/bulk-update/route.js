import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * PUT /api/customers/bulk-update
 * Body: { rows: [{id, name, email, phone, address, category, is_vat, vat_number, contact_name, contact_role, contact_email, contact_phone}] }
 * Returns: { updated: N, skipped: [{id, reason}], failed: [{id, error}] }
 */
export async function PUT(req) {
    try {
        const { rows } = await req.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
        }

        const updated = [];
        const skipped = [];
        const failed  = [];

        for (const row of rows) {
            const id = parseInt(row.id);
            if (!id || isNaN(id)) {
                skipped.push({ id: row.id, reason: 'Missing or invalid id' });
                continue;
            }
            if (!row.name?.trim()) {
                skipped.push({ id, reason: 'Name is required' });
                continue;
            }
            try {
                const [result] = await pool.execute(
                    `UPDATE customers SET
                        code=?, name=?, email=?, phone=?, address=?, category=?,
                        is_vat=?, vat_number=?, contact_name=?, contact_role=?,
                        contact_email=?, contact_phone=?
                     WHERE id=?`,
                    [
                        row.code?.trim() || null,
                        row.name.trim(),
                        row.email?.trim() || null,
                        row.phone?.trim() || null,
                        row.address?.trim() || null,
                        row.category?.trim() || null,
                        row.is_vat ? 1 : 0,
                        row.vat_number?.trim() || null,
                        row.contact_name?.trim() || null,
                        row.contact_role?.trim() || null,
                        row.contact_email?.trim() || null,
                        row.contact_phone?.trim() || null,
                        id,
                    ]
                );
                if (result.affectedRows > 0) updated.push(id);
                else skipped.push({ id, reason: 'Customer not found' });
            } catch (err) {
                failed.push({ id, error: err.message });
            }
        }

        return NextResponse.json({ updated: updated.length, skipped, failed });
    } catch (error) {
        console.error('Bulk update customers error:', error);
        return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
    }
}
