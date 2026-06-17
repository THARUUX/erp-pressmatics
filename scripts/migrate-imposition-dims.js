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
        console.log("Starting Migration: Adding composition dimensions & bleed to 'quotation_item_details'...");

        // Check if comp_width_cm column exists
        const [compWidthCols] = await connection.execute("SHOW COLUMNS FROM quotation_item_details LIKE 'comp_width_cm'");
        if (compWidthCols.length === 0) {
            await connection.execute("ALTER TABLE quotation_item_details ADD COLUMN comp_width_cm DECIMAL(10, 2) NULL DEFAULT NULL AFTER paper_height_cm");
            console.log("Column 'comp_width_cm' added successfully.");
        } else {
            console.log("Column 'comp_width_cm' already exists.");
        }

        // Check if comp_height_cm column exists
        const [compHeightCols] = await connection.execute("SHOW COLUMNS FROM quotation_item_details LIKE 'comp_height_cm'");
        if (compHeightCols.length === 0) {
            await connection.execute("ALTER TABLE quotation_item_details ADD COLUMN comp_height_cm DECIMAL(10, 2) NULL DEFAULT NULL AFTER comp_width_cm");
            console.log("Column 'comp_height_cm' added successfully.");
        } else {
            console.log("Column 'comp_height_cm' already exists.");
        }

        // Check if bleed_mm column exists
        const [bleedCols] = await connection.execute("SHOW COLUMNS FROM quotation_item_details LIKE 'bleed_mm'");
        if (bleedCols.length === 0) {
            await connection.execute("ALTER TABLE quotation_item_details ADD COLUMN bleed_mm DECIMAL(5, 2) NULL DEFAULT 3.00 AFTER comp_height_cm");
            console.log("Column 'bleed_mm' added successfully.");
        } else {
            console.log("Column 'bleed_mm' already exists.");
        }

        console.log("Migration finished successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
