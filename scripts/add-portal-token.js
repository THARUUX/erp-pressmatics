const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
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
        console.log('Adding portal_token column to customers...');
        // TiDB does not support inline UNIQUE on ADD COLUMN — use two steps
        await pool.execute(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS portal_token VARCHAR(64) DEFAULT NULL
        `);
        // Add unique index separately (ignore if already exists)
        try {
            await pool.execute(`
                ALTER TABLE customers ADD UNIQUE INDEX idx_customers_portal_token (portal_token)
            `);
        } catch (idxErr) {
            if (!idxErr.message?.includes('Duplicate')) throw idxErr;
        }
        console.log('Done. portal_token column + unique index added.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
