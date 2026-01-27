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

        console.log('Adding New Columns to inventory_items...');

        // Add item_code
        try {
            await connection.execute(`
                ALTER TABLE inventory_items 
                ADD COLUMN item_code VARCHAR(100) UNIQUE AFTER id
            `);
            console.log('Added item_code column.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('item_code column already exists.');
            else throw e;
        }

        // Add uom
        try {
            await connection.execute(`
                ALTER TABLE inventory_items 
                ADD COLUMN uom VARCHAR(50) DEFAULT 'Unit' AFTER type
            `);
            console.log('Added uom column.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('uom column already exists.');
            else throw e;
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
