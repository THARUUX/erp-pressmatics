const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
};

async function migrate() {
    let connection;
    try {
        console.log('Migrating database: Adding sales_order_bom table...');
        console.log(`Connecting to database at ${dbConfig.host}:${dbConfig.port}...`);

        connection = await mysql.createConnection(dbConfig);

        // 1. Add auto_deduct_stock column to sales_orders
        try {
            await connection.query(`
                ALTER TABLE sales_orders
                ADD COLUMN auto_deduct_stock TINYINT(1) DEFAULT 0 AFTER total_amount;
            `);
            console.log('Column auto_deduct_stock added to sales_orders.');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME' && !e.message.includes('Duplicate column name')) throw e;
            console.log('Column auto_deduct_stock already exists on sales_orders.');
        }

        // 2. Create sales_order_bom table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sales_order_bom (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sales_order_id INT NOT NULL,
                inventory_item_id INT NOT NULL,
                component_type ENUM('paper', 'plate', 'sfg', 'statics') NOT NULL,
                component_name VARCHAR(255) NOT NULL,
                required_qty DECIMAL(12, 4) NOT NULL,
                issued_qty DECIMAL(12, 4) DEFAULT 0.0000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
                FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('sales_order_bom table created.');

        console.log('Migration successful.');
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        if (connection) await connection.end();
        process.exit(1);
    }
}

migrate();
