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
        console.log("Starting Migration: Adding 'custom_wastage_sheets' to 'quotation_item_details'...");

        const [cols] = await connection.execute("SHOW COLUMNS FROM quotation_item_details LIKE 'custom_wastage_sheets'");
        if (cols.length === 0) {
            // Place it right after custom_impressions for logical grouping
            await connection.execute("ALTER TABLE quotation_item_details ADD COLUMN custom_wastage_sheets INT NULL DEFAULT NULL AFTER custom_impressions");
            console.log("Column 'custom_wastage_sheets' added successfully.");
        } else {
            console.log("Column 'custom_wastage_sheets' already exists.");
        }
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
