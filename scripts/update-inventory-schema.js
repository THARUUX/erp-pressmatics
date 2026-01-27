const mysql = require('mysql2/promise');

async function migrate() {
    try {
        const pool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log("Updating inventory schema...");

        // 1. Update inventory_items
        try {
            await pool.execute('ALTER TABLE inventory_items ADD COLUMN min_stock INT DEFAULT 0');
            console.log("Added min_stock column.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("min_stock column already exists.");
            else console.error(e);
        }

        try {
            await pool.execute('ALTER TABLE inventory_items ADD COLUMN is_active TINYINT(1) DEFAULT 1');
            console.log("Added is_active column.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("is_active column already exists.");
            else console.error(e);
        }

        // 2. Create inventory_transactions
        try {
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS inventory_transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    inventory_item_id INT NOT NULL,
                    type ENUM('issue_note', 'adjustment', 'usage') NOT NULL,
                    quantity DECIMAL(10, 5) NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
                )
            `);
            console.log("Created inventory_transactions table.");
        } catch (e) {
            console.error("Failed to create transactions table:", e);
        }

        console.log("Migration complete.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
