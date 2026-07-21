require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
    console.log("Starting stock action quantity precision migration...");

    // Connection configs
    const configs = [
        {
            name: "Company 1 (Primary)",
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '4000', 10),
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true,
            }
        },
        {
            name: "Company 2 (Secondary)",
            host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
            port: 4000,
            user: '2Db1nUiVftFh5mM.root',
            password: 'N8QPZ4x1VFYzaUq9',
            database: 'erp_press',
            ssl: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true,
            }
        }
    ];

    for (const config of configs) {
        console.log(`\nMigrating database for: ${config.name}...`);
        let conn;
        try {
            conn = await mysql.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database,
                ssl: config.ssl
            });

            console.log(`Connected to database: ${config.database}`);

            // 1. Alter inventory_transactions table
            console.log("Altering column `quantity` in `inventory_transactions` to DECIMAL(15, 5)...");
            await conn.execute('ALTER TABLE inventory_transactions MODIFY COLUMN quantity DECIMAL(15, 5) NOT NULL');
            console.log("Successfully altered `inventory_transactions.quantity`.");

            // 2. Alter employee_stock_actions table
            console.log("Altering column `quantity` in `employee_stock_actions` to DECIMAL(15, 5)...");
            await conn.execute('ALTER TABLE employee_stock_actions MODIFY COLUMN quantity DECIMAL(15, 5) NOT NULL');
            console.log("Successfully altered `employee_stock_actions.quantity`.");

        } catch (error) {
            console.error(`Migration failed for ${config.name}:`, error);
        } finally {
            if (conn) {
                await conn.end();
            }
        }
    }

    console.log("\nStock action quantity precision migration finished!");
}

runMigration();
