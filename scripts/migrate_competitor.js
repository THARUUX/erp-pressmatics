import pool from '../lib/db.js';

async function migrate() {
    const conn = await pool.getConnection();
    try {
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS competitor_analyses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT NULL,
                estimation_id INT NULL,
                estimation_snapshot JSON NULL,
                our_total DECIMAL(12,2) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ competitor_analyses table created.');

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS competitor_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                analysis_id INT NOT NULL,
                competitor_name VARCHAR(255) NOT NULL,
                quoted_price DECIMAL(12,2) NOT NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (analysis_id) REFERENCES competitor_analyses(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ competitor_entries table created.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
