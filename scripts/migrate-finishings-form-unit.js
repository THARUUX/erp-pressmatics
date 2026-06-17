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

        console.log("Modifying 'cost_unit' column to support 'Form' and 'Impression'...");
        await connection.execute(`
            ALTER TABLE quotation_item_finishings 
            MODIFY COLUMN cost_unit ENUM('Unit', 'Cut Sheet', 'Page', 'Form', 'Impression') NOT NULL DEFAULT 'Unit'
        `);
        console.log("Column 'cost_unit' modified successfully.");

        console.log("Adding 'forms' column to 'quotation_item_finishings'...");
        const [cols] = await connection.execute("SHOW COLUMNS FROM quotation_item_finishings LIKE 'forms'");
        if (cols.length === 0) {
            await connection.execute("ALTER TABLE quotation_item_finishings ADD COLUMN forms INT NULL DEFAULT NULL AFTER cost_unit");
            console.log("Column 'forms' added successfully.");
        } else {
            console.log("Column 'forms' already exists.");
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
