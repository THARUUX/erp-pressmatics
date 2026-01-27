const mysql = require('mysql2/promise');

async function migrate() {
    let connection;
    try {
        console.log('Migrating database: Adding Customers table...');

        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press'
        });

        // 1. Create customers table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table customers created/verified.');

        // 2. Add customer_id to quotation_items
        try {
            await connection.query(`
                ALTER TABLE quotation_items
                ADD COLUMN customer_id INT NULL,
                ADD CONSTRAINT fk_quotation_customer
                FOREIGN KEY (customer_id) REFERENCES customers(id)
                ON DELETE SET NULL;
            `);
            console.log('Column customer_id added to quotation_items.');
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
