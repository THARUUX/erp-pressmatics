const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '4000', 10),
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true,
            },
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log("Modifying markup_percent column in quotation_items to DECIMAL(10,5)...");
        await pool.execute('ALTER TABLE quotation_items MODIFY COLUMN markup_percent DECIMAL(10,5) DEFAULT 0.00000');
        console.log("Successfully modified column precision.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
