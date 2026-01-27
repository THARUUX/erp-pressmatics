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

        // Insert default settings if they don't exist
        const defaults = [
            { key: 'item_code_template', value: 'INV-{0000}' },
            { key: 'next_item_code_seq', value: '1' }
        ];

        for (const setting of defaults) {
            await connection.execute(
                'INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)',
                [setting.key, setting.value]
            );
        }

        console.log('Settings item_code_template and next_item_code_seq initialized.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
