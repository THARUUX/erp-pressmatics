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
        console.log("Starting Migration: Adding cut sheet dimensions to 'quotation_item_details'...");

        // Check if cut_width_cm column exists
        const [cutWidthCols] = await connection.execute("SHOW COLUMNS FROM quotation_item_details LIKE 'cut_width_cm'");
        if (cutWidthCols.length === 0) {
            await connection.execute("ALTER TABLE quotation_item_details ADD COLUMN cut_width_cm DECIMAL(10, 2) NULL DEFAULT NULL AFTER comp_height_cm");
            console.log("Column 'cut_width_cm' added successfully.");
        } else {
            console.log("Column 'cut_width_cm' already exists.");
        }

        // Check if cut_height_cm column exists
        const [cutHeightCols] = await connection.execute("SHOW COLUMNS FROM quotation_item_details LIKE 'cut_height_cm'");
        if (cutHeightCols.length === 0) {
            await connection.execute("ALTER TABLE quotation_item_details ADD COLUMN cut_height_cm DECIMAL(10, 2) NULL DEFAULT NULL AFTER cut_width_cm");
            console.log("Column 'cut_height_cm' added successfully.");
        } else {
            console.log("Column 'cut_height_cm' already exists.");
        }

        console.log("Migration finished successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
