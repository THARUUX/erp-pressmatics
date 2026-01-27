const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Empty as verified
    database: 'erp_press'
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log("Starting Migration: Separating Items from Quotations...");

        // 1. Rename existing 'quotations' to 'quotation_items'
        // Check if table exists first to avoid double run errors
        const [rows] = await connection.execute("SHOW TABLES LIKE 'quotations'");
        if (rows.length > 0) {
            // We need to check if it's the OLD quotations table (has job_description) or NEW one.
            // If it has job_description, it's the old one -> rename it.
            const [cols] = await connection.execute("SHOW COLUMNS FROM quotations LIKE 'job_description'");
            if (cols.length > 0) {
                console.log("Renaming 'quotations' to 'quotation_items'...");
                await connection.execute("RENAME TABLE quotations TO quotation_items");

                // Add status column
                await connection.execute("ALTER TABLE quotation_items ADD COLUMN status ENUM('draft', 'linked') DEFAULT 'draft'");
                // Add item_name (optional alias for user reference)
                await connection.execute("ALTER TABLE quotation_items ADD COLUMN item_name VARCHAR(255) NULL AFTER customer_name");
            }
        }

        // 2. Rename details tables
        // quotation_details -> quotation_item_details
        const [dRows] = await connection.execute("SHOW TABLES LIKE 'quotation_details'");
        if (dRows.length > 0) {
            console.log("Renaming 'quotation_details' to 'quotation_item_details'...");
            await connection.execute("RENAME TABLE quotation_details TO quotation_item_details");
            await connection.execute("ALTER TABLE quotation_item_details CHANGE quotation_id quotation_item_id INT");
        }

        // quotation_finishings -> quotation_item_finishings
        const [fRows] = await connection.execute("SHOW TABLES LIKE 'quotation_finishings'");
        if (fRows.length > 0) {
            console.log("Renaming 'quotation_finishings' to 'quotation_item_finishings'...");
            await connection.execute("RENAME TABLE quotation_finishings TO quotation_item_finishings");
            await connection.execute("ALTER TABLE quotation_item_finishings CHANGE quotation_id quotation_item_id INT");
        }

        // 3. Create NEW 'quotations' table (The Container)
        console.log("Creating new 'quotations' container table...");
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS quotations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL,
                quotation_date DATE DEFAULT (CURRENT_DATE),
                total_amount DECIMAL(10,2) DEFAULT 0.00,
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Create Link Table
        console.log("Creating 'quotation_line_items' link table...");
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS quotation_line_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quotation_id INT NOT NULL,
                quotation_item_id INT NOT NULL,
                display_order INT DEFAULT 0,
                FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
                FOREIGN KEY (quotation_item_id) REFERENCES quotation_items(id)
            )
        `);

        console.log("Migration Successful!");

    } catch (error) {
        console.error("Migration Failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
