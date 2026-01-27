const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Replace with actual credentials if different in dev
    database: 'erp_press'
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('Adding `pages` column to `quotation_details`...');

        // Check if column exists first to avoid error? Or just try-catch.
        // We will default pages to 1 for existing records.
        await connection.query(`
            ALTER TABLE quotation_details
            ADD COLUMN pages INT DEFAULT 1 AFTER machine_id;
        `);

        console.log('Migration successful.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column `pages` already exists.');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        await connection.end();
    }
}

migrate();
