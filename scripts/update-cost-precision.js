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

        console.log('Updating finishings.unit_cost to DECIMAL(10, 5)...');
        await connection.execute("ALTER TABLE finishings MODIFY COLUMN unit_cost DECIMAL(10, 5) DEFAULT 0.00000");

        console.log('Updating inventory_items.unit_cost to DECIMAL(10, 5)...');
        await connection.execute("ALTER TABLE inventory_items MODIFY COLUMN unit_cost DECIMAL(10, 5) DEFAULT 0.00000");

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
