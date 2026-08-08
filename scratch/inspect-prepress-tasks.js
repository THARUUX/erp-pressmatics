const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
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

    const [rows] = await pool.execute(`
        SELECT jt.id, jt.name, jt.quantity, jt.sheet_count, jt.impression_count, jt.scheduled_date 
        FROM job_tasks jt
        JOIN machines m ON jt.machine_id = m.id
        WHERE m.type = 'prepress'
        LIMIT 20
    `);
    console.log(JSON.stringify(rows, null, 2));
    await pool.end();
}

run().catch(console.error);
