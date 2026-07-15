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
        const [columns] = await pool.execute(`DESCRIBE customers`);
        console.log('Customers table columns:', columns.map(c => ({ name: c.Field, type: c.Type, null: c.Null })));
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err);
        process.exit(1);
    }
}

run();
