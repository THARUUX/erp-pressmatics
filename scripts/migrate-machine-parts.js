require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    // Database 1 (from dotenv)
    try {
        const conn1 = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '4000', 10),
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        });
        console.log('Connected to Company 1 database.');
        await conn1.execute(`
            CREATE TABLE IF NOT EXISTS machine_parts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                machine_id INT NOT NULL,
                part_name VARCHAR(255) NOT NULL,
                limit_run_quantity DECIMAL(12,2) NULL,
                balance_run_quantity DECIMAL(12,2) NULL,
                limit_hours DECIMAL(10,2) NULL,
                balance_hours DECIMAL(10,2) NULL,
                last_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
            )
        `);
        console.log('machine_parts table checked/created in Company 1.');
        await conn1.end();
    } catch (e) {
        console.error('Company 1 migration failed:', e);
    }

    // Database 2 (hardcoded in lib/db.js)
    try {
        const conn2 = await mysql.createConnection({
            host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
            port: 4000,
            user: '2Db1nUiVftFh5mM.root',
            password: 'N8QPZ4x1VFYzaUq9',
            database: 'erp_press',
            ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        });
        console.log('Connected to Company 2 database.');
        await conn2.execute(`
            CREATE TABLE IF NOT EXISTS machine_parts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                machine_id INT NOT NULL,
                part_name VARCHAR(255) NOT NULL,
                limit_run_quantity DECIMAL(12,2) NULL,
                balance_run_quantity DECIMAL(12,2) NULL,
                limit_hours DECIMAL(10,2) NULL,
                balance_hours DECIMAL(10,2) NULL,
                last_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
            )
        `);
        console.log('machine_parts table checked/created in Company 2.');
        await conn2.end();
    } catch (e) {
        console.error('Company 2 migration failed:', e);
    }
}

migrate();
