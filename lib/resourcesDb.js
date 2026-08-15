import pool from '@/lib/db';

let tablesEnsured = false;

export async function ensureResourceTables() {
    if (tablesEnsured) return;
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS resource_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                parent_id INT NULL DEFAULT NULL,
                description TEXT NULL,
                icon VARCHAR(50) DEFAULT 'folder',
                color VARCHAR(50) DEFAULT 'blue',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_parent (parent_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS resource_links (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_id INT NULL DEFAULT NULL,
                title VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                description TEXT NULL,
                icon VARCHAR(50) DEFAULT 'globe',
                color VARCHAR(50) DEFAULT 'emerald',
                tags VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_category (category_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        tablesEnsured = true;
    } catch (error) {
        console.error('Error creating resource tables:', error);
        throw error;
    }
}
