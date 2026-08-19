import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { logActivity } from '@/lib/activityLogger';

// GET /api/invoices  — list with filters
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const page       = parseInt(searchParams.get('page')   || '1');
        const limit      = parseInt(searchParams.get('limit')  || '500');
        const status     = searchParams.get('status') || '';
        const search     = searchParams.get('search') || '';
        const service_id = searchParams.get('service_id') || '';
        const exclude_services = searchParams.get('exclude_services') || '';
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (service_id) {
            where += ' AND (i.service_id = ? OR q.service_id = ?)';
            params.push(service_id, service_id);
        } else if (exclude_services === 'true' || exclude_services === '1') {
            where += ' AND i.service_id IS NULL';
        }

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
            `SELECT COUNT(*) AS total FROM invoices i LEFT JOIN quotations q ON i.quotation_id = q.id ${where}`,
            params
        );

        let activeCompanyId = 1;
        try {
            const cookieStore = await cookies();
            const c = cookieStore.get('company_id');
            if (c && c.value) activeCompanyId = parseInt(c.value, 10);
        } catch (e) {}

        // Stats
        let statsWhere = 'WHERE (i.company_id = ? OR (i.company_id IS NULL AND ? = 1))';
        const statsParams = [activeCompanyId, activeCompanyId];
        if (service_id) {
            statsWhere += ' AND (i.service_id = ? OR q.service_id = ?)';
            statsParams.push(service_id, service_id);
        } else if (exclude_services === 'true' || exclude_services === '1') {
            statsWhere += ' AND i.service_id IS NULL';
        }

        const [[stats]] = await pool.execute(`
            SELECT
                SUM(CASE WHEN i.status IN ('sent','partial') THEN i.amount_due - i.amount_paid ELSE 0 END) AS outstanding,
                SUM(CASE WHEN i.status = 'overdue'           THEN i.amount_due - i.amount_paid ELSE 0 END) AS overdue,
                SUM(CASE WHEN MONTH(i.created_at) = MONTH(CURDATE()) AND YEAR(i.created_at) = YEAR(CURDATE()) THEN i.amount_paid ELSE 0 END) AS collected_month
            FROM invoices i
            LEFT JOIN quotations q ON i.quotation_id = q.id
            ${statsWhere}
        `, statsParams);

        return NextResponse.json({ invoices: rows, total, stats });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/invoices  — create invoice
export async function POST(req) {
    try {
        let activeCompanyId = 1;
        try {
            const cookieStore = await cookies();
            const c = cookieStore.get('company_id');
            if (c && c.value) activeCompanyId = parseInt(c.value, 10);
        } catch (e) {}

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
                (code, quotation_id, customer_id, customer_name, description, amount_due, due_date, notes, status, company_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            code,
            quotation_id || null,
            customer_id  || null,
            customer_name || '',
            description  || '',
            parseFloat(amount_due) || 0,
            due_date     || null,
            notes        || '',
            status       || 'draft',
            activeCompanyId
        ]);

        logActivity({
            req,
            action: 'CREATE',
            entity_type: 'invoice',
            entity_id: code,
            details: `Created invoice "${code}" for customer "${customer_name}" (LKR ${parseFloat(amount_due || 0).toFixed(2)})`
        });

        return NextResponse.json({ id: result.insertId, code }, { status: 201 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
