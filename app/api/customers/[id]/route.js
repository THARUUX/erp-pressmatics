import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute('SELECT id, code, name, email, phone, address, created_at, is_vat, vat_number, contact_name, contact_phone, contact_email, contact_role, starting_outstanding, category, portal_token, (portal_password IS NOT NULL) AS has_password FROM customers WHERE id = ?', [id]);
        if (rows.length === 0) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        return NextResponse.json(rows[0]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, email, phone, address, is_vat, vat_number, contact_name, contact_phone, contact_email, contact_role, starting_outstanding, category, portal_password, clear_password } = body;

        let passwordHash = undefined;
        if (clear_password) {
            passwordHash = null;
        } else if (portal_password && portal_password.trim() !== '') {
            passwordHash = await bcrypt.hash(portal_password.trim(), 10);
        }

        if (passwordHash !== undefined) {
            await pool.execute(
                'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, is_vat = ?, vat_number = ?, contact_name = ?, contact_phone = ?, contact_email = ?, contact_role = ?, starting_outstanding = ?, category = ?, portal_password = ? WHERE id = ?',
                [name, email || null, phone || null, address || null, is_vat ? 1 : 0, vat_number || null, contact_name || null, contact_phone || null, contact_email || null, contact_role || null, parseFloat(starting_outstanding) || 0, category || null, passwordHash, id]
            );
        } else {
            await pool.execute(
                'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, is_vat = ?, vat_number = ?, contact_name = ?, contact_phone = ?, contact_email = ?, contact_role = ?, starting_outstanding = ?, category = ? WHERE id = ?',
                [name, email || null, phone || null, address || null, is_vat ? 1 : 0, vat_number || null, contact_name || null, contact_phone || null, contact_email || null, contact_role || null, parseFloat(starting_outstanding) || 0, category || null, id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update customer error:', error);
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const fields = [];
        const values = [];
        if (body.starting_outstanding !== undefined) { fields.push('starting_outstanding = ?'); values.push(parseFloat(body.starting_outstanding) || 0); }
        if (body.category !== undefined) { fields.push('category = ?'); values.push(body.category || null); }
        if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        values.push(id);
        await pool.execute(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to patch customer' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        // FK constraint might fail if used
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }
}
