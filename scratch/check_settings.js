const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
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
        const [rows] = await pool.execute(
            `SELECT setting_key, LENGTH(setting_value) as len, SUBSTRING(setting_value, 1, 50) as snippet FROM settings`
        );
        console.log('Settings keys and values length:');
        console.log(rows);
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err);
        process.exit(1);
    }
}

check();
