const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press'
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        console.log('Creating finishing_variants table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS finishing_variants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                finishing_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                unit_cost DECIMAL(10, 5) DEFAULT 0.00000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (finishing_id) REFERENCES finishings(id) ON DELETE CASCADE
            )
        `);

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
