const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        waitForConnections: true, connectionLimit: 3, queueLimit: 0
    });

    const token = '2de7aef9464b6d8a2c3db3eb27899bb6c97dcad656d715140092c48118c1ef09';
    try {
        const [[customer]] = await pool.execute(
            `SELECT id, name, email, phone, address, category, is_vat, vat_number,
                    contact_name, contact_role, contact_email, contact_phone, created_at
             FROM customers WHERE portal_token = ?`,
            [token]
        );
        if (!customer) {
            console.log('Customer not found for token:', token);
            process.exit(0);
        }
        console.log('Customer found:', customer);

        const customerId = customer.id;

        const [quotations] = await pool.execute(`
            SELECT q.code, q.status, q.total_amount, q.quotation_date,
                (SELECT qi.estimation_name
                 FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = q.id ORDER BY qli.display_order ASC LIMIT 1
                ) AS first_item_name
            FROM quotations q
            WHERE q.customer_id = ? OR (q.customer_id IS NULL AND q.customer_name = ?)
            ORDER BY q.created_at DESC
            LIMIT 30
        `, [customerId, customer.name]);

        console.log('Quotations:', quotations.length, quotations.slice(0, 3));

        const [invoices] = await pool.execute(`
            SELECT i.code, i.status, i.amount_due, i.amount_paid,
                   (i.amount_due - i.amount_paid) AS balance,
                   i.due_date, i.created_at,
                   q.code AS quotation_code
            FROM invoices i
            LEFT JOIN quotations q ON i.quotation_id = q.id
            WHERE i.customer_id = ? OR (i.customer_id IS NULL AND i.customer_name = ?)
            ORDER BY i.created_at DESC
            LIMIT 50
        `, [customerId, customer.name]);

        console.log('Invoices:', invoices.length, invoices.slice(0, 3));

        const [salesOrders] = await pool.execute(`
            SELECT so.id AS order_id, so.code, so.status, so.delivery_date, so.created_at,
                   q.code AS quotation_code, q.total_amount,
                   (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                    FROM quotation_items qi
                    JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                    WHERE qli.quotation_id = so.quotation_id) AS job_names
            FROM sales_orders so
            JOIN quotations q ON so.quotation_id = q.id
            WHERE q.customer_id = ? OR (q.customer_id IS NULL AND so.customer_name = ?)
            ORDER BY so.created_at DESC
            LIMIT 30
        `, [customerId, customer.name]);

        console.log('Sales Orders:', salesOrders.length, salesOrders.slice(0, 3));

        const [[invStats]] = await pool.execute(`
            SELECT
                COALESCE(SUM(amount_paid), 0) AS total_paid,
                COALESCE(SUM(amount_due), 0)  AS total_billed,
                COALESCE(SUM(CASE WHEN status != 'paid' THEN amount_due - amount_paid ELSE 0 END), 0) AS outstanding,
                COUNT(*) AS invoice_count
            FROM invoices 
            WHERE customer_id = ? OR (customer_id IS NULL AND customer_name = ?)
        `, [customerId, customer.name]);

        console.log('InvStats:', invStats);

        const [[qStats]] = await pool.execute(`
            SELECT COUNT(*) AS total_quotes,
                   COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted_count
            FROM quotations 
            WHERE customer_id = ? OR (customer_id IS NULL AND customer_name = ?)
        `, [customerId, customer.name]);

        console.log('QStats:', qStats);
        
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err);
        process.exit(1);
    }
}

run();
