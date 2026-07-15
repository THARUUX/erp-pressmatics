const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigrationForPool(pool, name) {
    console.log(`Running loyalty points migration for ${name}...`);
    try {
        // 1. Add points column to customers table if not exists
        await pool.execute(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS points INT DEFAULT 0
        `);
        console.log(`- [${name}] points column checked/added to customers.`);

        // 2. Create customer_points_transactions table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS customer_points_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                points INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                reference_id VARCHAR(100) DEFAULT NULL,
                description VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY fk_customer_points_cust_id (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log(`- [${name}] customer_points_transactions table checked/created.`);
    } catch (err) {
        console.error(`- [${name}] migration failed:`, err);
        throw err;
    }
}

async function run() {
    // Pool 1 (Company 1)
    const pool1 = mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        waitForConnections: true, connectionLimit: 3, queueLimit: 0
    });

    // Pool 2 (Company 2)
    const pool2 = mysql.createPool({
        host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '2Db1nUiVftFh5mM.root',
        password: 'N8QPZ4x1VFYzaUq9',
        database: 'erp_press',
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        waitForConnections: true, connectionLimit: 3, queueLimit: 0
    });

    try {
        await runMigrationForPool(pool1, 'Company 1 (Primary)');
        await runMigrationForPool(pool2, 'Company 2');
        console.log('All migrations completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
