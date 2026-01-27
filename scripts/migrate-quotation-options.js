
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'erp_press'
    });

    try {
        console.log('Adding show_grand_total column to quotations table...');

        // Add column if not exists
        try {
            await connection.execute(`
                ALTER TABLE quotations 
                ADD COLUMN show_grand_total BOOLEAN DEFAULT TRUE
            `);
            console.log('Column show_grand_total added.');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('Column show_grand_total already exists.');
            } else {
                throw error;
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
