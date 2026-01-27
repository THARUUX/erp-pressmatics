const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Changed to empty string per suspect config
    database: 'erp_press'
};

async function migrate() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        console.log('Creating plates table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS plates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                unit_cost DECIMAL(10, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Checking for plate_id column in machines table...');
        const [columns] = await connection.execute(`
            SHOW COLUMNS FROM machines LIKE 'plate_id'
        `);

        if (columns.length === 0) {
            console.log('Adding plate_id column to machines table...');
            await connection.execute(`
                ALTER TABLE machines
                ADD COLUMN plate_id INT NULL
            `);
            console.log('Added plate_id column.');
        } else {
            console.log('plate_id column already exists.');
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
