const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrate() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '4000', 10),
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true,
            }
        });
        console.log('Connected successfully.');

        const columns = [
            { name: 'contact_name', type: 'VARCHAR(255) NULL' },
            { name: 'contact_phone', type: 'VARCHAR(50) NULL' },
            { name: 'contact_email', type: 'VARCHAR(255) NULL' },
            { name: 'contact_role', type: 'VARCHAR(100) NULL' }
        ];

        for (const col of columns) {
            try {
                await connection.execute(`ALTER TABLE customers ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Added column '${col.name}' to customers table.`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column '${col.name}' already exists.`);
                } else {
                    throw e;
                }
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
