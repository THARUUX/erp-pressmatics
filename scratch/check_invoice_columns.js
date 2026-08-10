const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });
    console.log('Connected.');

    const [columns] = await conn.execute('SHOW COLUMNS FROM invoices');
    console.log('--- INVOICES COLUMNS ---');
    console.log(columns.map(c => `${c.Field} (${c.Type})`));

    const [soColumns] = await conn.execute('SHOW COLUMNS FROM sales_orders');
    console.log('--- SALES ORDERS COLUMNS ---');
    console.log(soColumns.map(c => `${c.Field} (${c.Type})`));

    await conn.end();
}

main().catch(console.error);
