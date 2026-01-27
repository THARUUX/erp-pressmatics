const mysql = require('mysql2/promise');

async function migrate() {
    let connection;
    try {
        console.log('Migrating database: Adding is_favorite to quotation_items...');

        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press'
        });

        await connection.query(`
            ALTER TABLE quotation_items
            ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
        `);

        console.log('Migration successful: is_favorite column added.');
        await connection.end();
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column is_favorite already exists.');
            if (connection) await connection.end();
            process.exit(0);
        }
        console.error('Migration failed:', error);
        if (connection) await connection.end();
        process.exit(1);
    }
}

migrate();
