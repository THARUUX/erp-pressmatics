const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press'
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log("Starting Migration: Adding 'custom_impressions' to 'quotation_item_details'...");
        
        // Check if column already exists
        const [cols] = await connection.execute("SHOW COLUMNS FROM quotation_item_details LIKE 'custom_impressions'");
        if (cols.length === 0) {
            await connection.execute("ALTER TABLE quotation_item_details ADD COLUMN custom_impressions INT NULL DEFAULT NULL AFTER colors");
            console.log("Column 'custom_impressions' added successfully.");
        } else {
            console.log("Column 'custom_impressions' already exists.");
        }
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
