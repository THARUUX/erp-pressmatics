const mysql = require('mysql2/promise');

async function migrate() {
    let connection;
    try {
        console.log('Migrating database: Adding customer_id to quotations table...');

        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press'
        });

        // Add customer_id to quotations
        try {
            await connection.query(`
                ALTER TABLE quotations
                ADD COLUMN customer_id INT NULL,
                ADD CONSTRAINT fk_quotations_customer
                FOREIGN KEY (customer_id) REFERENCES customers(id)
                ON DELETE SET NULL;
            `);
            console.log('Column customer_id added to quotations.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column customer_id already exists.');
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
