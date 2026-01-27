const mysql = require('mysql2/promise');

async function migrate() {
    let connection;
    try {
        console.log('Migrating database: Adding estimation_name to quotation_items...');

        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press'
        });

        // Add estimation_name
        try {
            await connection.query(`
                ALTER TABLE quotation_items
                ADD COLUMN estimation_name VARCHAR(255) NULL AFTER code;
            `);
            console.log('Column estimation_name added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column estimation_name already exists.');
            } else {
                throw e;
            }
        }

        console.log('Migration successful.');
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        if (connection) await connection.end();
        process.exit(1);
    }
}

migrate();
