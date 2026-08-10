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

    console.log('--- SERVICES ---');
    const [services] = await conn.execute('SELECT id, name FROM services LIMIT 5');
    console.log(services);

    console.log('--- SALES ORDERS ---');
    const [salesOrders] = await conn.execute('SELECT id, code, service_id, customer_name, total_amount FROM sales_orders LIMIT 5');
    console.log(salesOrders);

    await conn.end();
}

main().catch(console.error);
