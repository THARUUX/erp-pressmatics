
const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'erp_press'
    });

    try {
        console.log('Modifying setting_value column to LONGTEXT...');
        await connection.execute(`
            ALTER TABLE settings 
            MODIFY setting_value LONGTEXT
        `);
        console.log('Column modified successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
