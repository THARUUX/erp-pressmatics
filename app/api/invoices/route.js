import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/invoices  — list with filters
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const page   = parseInt(searchParams.get('page')   || '1');
        const limit  = parseInt(searchParams.get('limit')  || '20');
        const status = searchParams.get('status') || '';
        const search = searchParams.get('search') || '';
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (status && status !== 'all') {
            where += ' AND i.status = ?';
            params.push(status);
        }
        if (search) {
            where += ' AND (i.code LIKE ? OR i.customer_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [rows] = await pool.execute(`
            SELECT i.*,
                (i.amount_due - i.amount_paid) AS balance,
                q.code AS quotation_code,
                c.phone AS customer_phone
            FROM invoices i
            LEFT JOIN quotations q ON i.quotation_id = q.id
            LEFT JOIN customers c ON i.customer_id = c.id
            ${where}
            ORDER BY i.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `, params);

        const [[{ total }]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM invoices i ${where}`,
            params
        );

        // Stats
        const [[stats]] = await pool.execute(`
            SELECT
                SUM(CASE WHEN status IN ('sent','partial') THEN amount_due - amount_paid ELSE 0 END) AS outstanding,
                SUM(CASE WHEN status = 'overdue'           THEN amount_due - amount_paid ELSE 0 END) AS overdue,
                SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN amount_paid ELSE 0 END) AS collected_month
            FROM invoices
        `);

        return NextResponse.json({ invoices: rows, total, stats });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/invoices  — create invoice
export async function POST(req) {
    try {
        const body = await req.json();
        const {
            quotation_id, customer_id, customer_name,
            description, amount_due, due_date, notes, status
        } = body;

        // Generate sequential code
        const [[{ maxId }]] = await pool.execute('SELECT COALESCE(MAX(id),0) AS maxId FROM invoices');
        const code = `INV-${String(maxId + 1).padStart(4, '0')}`;

        const [result] = await pool.execute(`
            INSERT INTO invoices
                (code, quotation_id, customer_id, customer_name, description, amount_due, due_date, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            code,
            quotation_id || null,
            customer_id  || null,
            customer_name || '',
            description  || '',
            parseFloat(amount_due) || 0,
            due_date     || null,
            notes        || '',
            status       || 'draft'
        ]);

        return NextResponse.json({ id: result.insertId, code }, { status: 201 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
