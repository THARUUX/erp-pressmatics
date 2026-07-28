const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
        }
    });
    const [rows] = await connection.query('SELECT id, sales_order_id, name, machine_name FROM job_tasks ORDER BY id DESC LIMIT 50');
    console.log(JSON.stringify(rows, null, 2));
    await connection.end();
}

run().catch(console.error);
