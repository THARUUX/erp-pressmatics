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

        console.log('Adding cost_unit column to finishings table...');
        await connection.execute("ALTER TABLE finishings ADD COLUMN cost_unit ENUM('Unit', 'Cut Sheet', 'Page') NOT NULL DEFAULT 'Unit'");

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
