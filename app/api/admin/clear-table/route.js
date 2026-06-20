import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/* Whitelist — only these tables may be cleared via this API */
const ALLOWED = {
    customers:       { label: 'Customers',     dbTable: 'customers',     resetSeq: 'customer_id_seq' },
    quotations:      { label: 'Quotations',     dbTable: 'quotations',     resetSeq: 'quotation_id_seq' },
    invoices:        { label: 'Invoices',       dbTable: 'invoices',       resetSeq: null },
    sales_orders:    { label: 'Sales Orders',   dbTable: 'sales_orders',   resetSeq: null },
    machine_tasks:   { label: 'Machine Tasks',  dbTable: 'job_tasks',      resetSeq: null },
    papers:          { label: 'Papers',         dbTable: 'papers',         resetSeq: null },
};

export async function GET() {
    try {
        const conn = await pool.getConnection();
        try {
            const stats = {};
            for (const [key, config] of Object.entries(ALLOWED)) {
                // Get exact row count
                const [countRes] = await conn.query(`SELECT COUNT(*) as count FROM \`${config.dbTable}\``);
                const count = countRes[0].count;

                // Get table size in bytes from information_schema
                const [sizeRes] = await conn.query(
                    `SELECT (data_length + index_length) AS size_bytes 
                     FROM information_schema.tables 
                     WHERE table_schema = DATABASE() AND table_name = ?`,
                    [config.dbTable]
                );
                const sizeBytes = sizeRes[0]?.size_bytes || 0;

                // Get min/max created_at dates
                const [dateRes] = await conn.query(
                    `SELECT MIN(created_at) as min_date, MAX(created_at) as max_date 
                     FROM \`${config.dbTable}\``
                );
                const minDate = dateRes[0]?.min_date || null;
                const maxDate = dateRes[0]?.max_date || null;

                stats[key] = {
                    count,
                    sizeBytes,
                    minDate,
                    maxDate
                };
            }
            return NextResponse.json({ stats });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Fetch table stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { table, resetSequence, beforeDate } = await req.json();

        if (!ALLOWED[table]) {
            return NextResponse.json({ error: 'Table not allowed' }, { status: 400 });
        }

        const config = ALLOWED[table];
        const conn = await pool.getConnection();
        try {
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');

            let affectedRows = 0;

            if (beforeDate) {
                if (table === 'customers') {
                    const [res] = await conn.query(`DELETE FROM customers WHERE created_at < ?`, [beforeDate]);
                    affectedRows = res.affectedRows;
                } else if (table === 'invoices') {
                    await conn.query(`DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE created_at < ?)`, [beforeDate]);
                    const [res] = await conn.query(`DELETE FROM invoices WHERE created_at < ?`, [beforeDate]);
                    affectedRows = res.affectedRows;
                } else if (table === 'sales_orders') {
                    await conn.query(`DELETE FROM job_tasks WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE created_at < ?)`, [beforeDate]);
                    const [res] = await conn.query(`DELETE FROM sales_orders WHERE created_at < ?`, [beforeDate]);
                    affectedRows = res.affectedRows;
                } else if (table === 'machine_tasks') {
                    const [res] = await conn.query(`DELETE FROM job_tasks WHERE created_at < ?`, [beforeDate]);
                    affectedRows = res.affectedRows;
                } else if (table === 'papers') {
                    const [res] = await conn.query(`DELETE FROM papers WHERE created_at < ?`, [beforeDate]);
                    affectedRows = res.affectedRows;
                } else if (table === 'quotations') {
                    await conn.query(`DELETE FROM quotation_item_finishings WHERE quotation_item_id IN (SELECT id FROM quotation_items WHERE created_at < ?)`, [beforeDate]);
                    await conn.query(`DELETE FROM quotation_item_details WHERE quotation_item_id IN (SELECT id FROM quotation_items WHERE created_at < ?)`, [beforeDate]);
                    await conn.query(`DELETE FROM quotation_line_items WHERE quotation_id IN (SELECT id FROM quotations WHERE created_at < ?)`, [beforeDate]);
                    await conn.query(`DELETE FROM quotation_line_items WHERE quotation_item_id IN (SELECT id FROM quotation_items WHERE created_at < ?)`, [beforeDate]);
                    await conn.query(`DELETE FROM quotation_items WHERE created_at < ?`, [beforeDate]);
                    const [res] = await conn.query(`DELETE FROM quotations WHERE created_at < ?`, [beforeDate]);
                    affectedRows = res.affectedRows;
                }
            } else {
                if (table === 'customers') {
                    const [res] = await conn.query(`DELETE FROM customers`);
                    affectedRows = res.affectedRows;
                } else if (table === 'invoices') {
                    await conn.query(`DELETE FROM invoice_payments`);
                    const [res] = await conn.query(`DELETE FROM invoices`);
                    affectedRows = res.affectedRows;
                } else if (table === 'sales_orders') {
                    await conn.query(`DELETE FROM job_tasks`);
                    const [res] = await conn.query(`DELETE FROM sales_orders`);
                    affectedRows = res.affectedRows;
                } else if (table === 'machine_tasks') {
                    const [res] = await conn.query(`DELETE FROM job_tasks`);
                    affectedRows = res.affectedRows;
                } else if (table === 'papers') {
                    const [res] = await conn.query(`DELETE FROM papers`);
                    affectedRows = res.affectedRows;
                } else if (table === 'quotations') {
                    await conn.query(`DELETE FROM quotation_item_finishings`);
                    await conn.query(`DELETE FROM quotation_item_details`);
                    await conn.query(`DELETE FROM quotation_line_items`);
                    await conn.query(`DELETE FROM quotation_items`);
                    const [res] = await conn.query(`DELETE FROM quotations`);
                    affectedRows = res.affectedRows;
                }

                if (resetSequence && config.resetSeq) {
                    await conn.query(
                        "UPDATE settings SET setting_value = '1' WHERE setting_key = ?",
                        [config.resetSeq]
                    );
                }
            }

            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
            return NextResponse.json({ deleted: affectedRows });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Clear table error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
