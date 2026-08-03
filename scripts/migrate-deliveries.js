require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const tableSqls = [
        `CREATE TABLE IF NOT EXISTS deliveries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sales_order_id INT NOT NULL,
            sales_order_code VARCHAR(50) NOT NULL,
            customer_name VARCHAR(255) NOT NULL,
            quotation_item_id INT NOT NULL,
            estimation_name VARCHAR(255) NOT NULL,
            total_quantity INT NOT NULL,
            delivered_quantity INT NOT NULL DEFAULT 0,
            books_per_parcel INT NOT NULL DEFAULT 50,
            status VARCHAR(50) NOT NULL DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (quotation_item_id) REFERENCES quotation_items(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS delivery_dispatches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            delivery_id INT NOT NULL,
            dispatched_quantity INT NOT NULL,
            parcels_count INT NOT NULL,
            carrier_name VARCHAR(255) NULL,
            tracking_number VARCHAR(255) NULL,
            notes TEXT NULL,
            dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
        )`
    ];

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
        for (const sql of tableSqls) {
            await conn1.execute(sql);
        }
        console.log('Deliveries tables checked/created in Company 1.');
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
        for (const sql of tableSqls) {
            await conn2.execute(sql);
        }
        console.log('Deliveries tables checked/created in Company 2.');
        await conn2.end();
    } catch (e) {
        console.error('Company 2 migration failed:', e);
    }
}

migrate();
