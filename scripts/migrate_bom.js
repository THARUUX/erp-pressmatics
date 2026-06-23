import pool from '../lib/db.js';

async function migrate() {
    const conn = await pool.getConnection();
    try {
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS inventory_bom (
                id INT AUTO_INCREMENT PRIMARY KEY,
                parent_item_id INT NOT NULL,
                component_item_id INT NOT NULL,
                quantity DECIMAL(10, 4) NOT NULL DEFAULT 1,
                notes VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
                FOREIGN KEY (component_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
            )
        `);
        console.log('✅ inventory_bom table created (or already exists).');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
