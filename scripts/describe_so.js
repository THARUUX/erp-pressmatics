const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: false,
        }
    });
    const [rows] = await conn.execute('DESCRIBE sales_orders');
    console.log(JSON.stringify(rows, null, 2));
    await conn.end();
}
main().catch(console.error);
