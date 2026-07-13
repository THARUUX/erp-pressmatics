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
            connectionLimit: 5,
            queueLimit: 0
        });

        console.log("Connecting to database and running employee stock actions migration...");

        // Create employee_stock_actions table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS employee_stock_actions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT DEFAULT NULL,
                team_id INT DEFAULT NULL,
                sales_order_id INT DEFAULT NULL,
                inventory_item_id INT NOT NULL,
                action_type ENUM('saved', 'wasted') NOT NULL,
                quantity DECIMAL(10, 5) NOT NULL,
                unit_cost DECIMAL(12, 4) NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_esa_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
                CONSTRAINT fk_esa_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
                CONSTRAINT fk_esa_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
                CONSTRAINT fk_esa_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log("Created table `employee_stock_actions` successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
