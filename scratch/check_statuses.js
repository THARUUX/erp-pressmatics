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

    try {
        const [invs] = await pool.execute(`SELECT DISTINCT status FROM invoices`);
        const [sos] = await pool.execute(`SELECT DISTINCT status FROM sales_orders`);
        const [quotes] = await pool.execute(`SELECT DISTINCT status FROM quotations`);

        console.log('Invoices distinct statuses:', invs.map(r => r.status));
        console.log('Sales orders distinct statuses:', sos.map(r => r.status));
        console.log('Quotations distinct statuses:', quotes.map(r => r.status));
        
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err);
        process.exit(1);
    }
}

run();
