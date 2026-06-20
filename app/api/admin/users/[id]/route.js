import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function PUT(req, { params }) {
    try {
        const id = parseInt((await params).id, 10);
        const { name, email, role, is_banned, password } = await req.json();

        // Safety check: Prevents a user from banning themselves
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const decoded = verifyToken(token);
        
        if (decoded && decoded.id === id && is_banned === 1) {
            return NextResponse.json({ error: 'You cannot ban yourself' }, { status: 400 });
        }

        // Build dynamic update query
        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            values.push(role);
        }
        if (is_banned !== undefined) {
            updates.push('is_banned = ?');
            values.push(is_banned ? 1 : 0);
        }
        if (password) {
            const hashedPassword = await hashPassword(password);
            updates.push('password = ?');
            values.push(hashedPassword);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(id);
        const [result] = await pool.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const id = parseInt((await params).id, 10);

        // Safety check: Prevents a user from deleting themselves
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        const decoded = verifyToken(token);

        if (decoded && decoded.id === id) {
            return NextResponse.json({ error: 'You cannot delete yourself' }, { status: 400 });
        }

        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
