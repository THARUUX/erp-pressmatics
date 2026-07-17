import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/employees/[id]/salary-items ──────────────────────────────────────
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute(
            'SELECT * FROM employee_allowances_deductions WHERE employee_id = ? ORDER BY type ASC, name ASC',
            [id]
        );
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[salary-items GET]', err);
        return NextResponse.json({ error: 'Failed to fetch salary items' }, { status: 500 });
    }
}

// ── POST /api/employees/[id]/salary-items ─────────────────────────────────────
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const { name, type, amount } = await req.json();

        if (!name?.trim() || !type || amount === undefined) {
            return NextResponse.json({ error: 'Missing name, type, or amount' }, { status: 400 });
        }

        if (type !== 'addition' && type !== 'deduction') {
            return NextResponse.json({ error: 'Invalid type. Must be addition or deduction' }, { status: 400 });
        }

        await pool.execute(
            `INSERT INTO employee_allowances_deductions (employee_id, name, type, amount)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
            [id, name.trim(), type, amount]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[salary-items POST]', err);
        return NextResponse.json({ error: 'Failed to save salary item' }, { status: 500 });
    }
}

// ── DELETE /api/employees/[id]/salary-items ───────────────────────────────────
export async function DELETE(req, { params }) {
    try {
        const { searchParams } = new URL(req.url);
        const itemId = searchParams.get('itemId');

        if (!itemId) {
            return NextResponse.json({ error: 'Missing itemId parameter' }, { status: 400 });
        }

        await pool.execute(
            'DELETE FROM employee_allowances_deductions WHERE id = ?',
            [itemId]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[salary-items DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete salary item' }, { status: 500 });
    }
}
