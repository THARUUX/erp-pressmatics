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

        // Check if column exists
        const [columns] = await connection.execute("SHOW COLUMNS FROM machines LIKE 'speed_unit'");

        if (columns.length === 0) {
            console.log('Adding speed_unit column...');
            await connection.execute("ALTER TABLE machines ADD COLUMN speed_unit VARCHAR(20) DEFAULT 'Sheets/Hr' AFTER speed");
            console.log('Column added successfully.');
        } else {
            console.log('Column speed_unit already exists. Skipping.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
