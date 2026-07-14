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
    }
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Create task_configurations table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS task_configurations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_key VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                display_order INT NOT NULL DEFAULT 0,
                is_bb_separated TINYINT(1) NOT NULL DEFAULT 0,
                estimated_minutes INT DEFAULT NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created task_configurations table.');

        // Check if seeded
        const [rows] = await connection.execute('SELECT COUNT(*) as cnt FROM task_configurations');
        if (rows[0].cnt === 0) {
            const defaults = [
                ['prepress', 'Pre-press / File Check', 'Check artwork files, preflight & colour profile verification', 10, 0, 15, 1],
                ['service', 'Services', 'Item service tasks', 20, 0, null, 1],
                ['plate_making', 'Plate Making', 'Offset plates preparation', 30, 0, null, 1],
                ['offset_printing', 'Offset Printing', 'Offset printing process', 40, 1, null, 1],
                ['digital_printing', 'Digital Print', 'Digital printing process', 50, 0, null, 1],
                ['finishing', 'Finishings', 'Finishing processes', 60, 0, null, 1],
                ['quality_check', 'Quality Check', 'Inspect quality of printed items', 80, 0, null, 1],
                ['packing', 'Packing', 'Pack items for delivery', 90, 0, null, 1],
                ['delivery', 'Delivery', 'Deliver to customer', 100, 0, null, 1]
            ];

            for (const d of defaults) {
                await connection.execute(
                    `INSERT INTO task_configurations (task_key, name, description, display_order, is_bb_separated, estimated_minutes, is_enabled)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    d
                );
            }
            console.log('Seeded default task configurations.');
        } else {
            console.log('task_configurations table already seeded.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
