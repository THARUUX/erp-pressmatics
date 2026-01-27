const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'erp_press'
    });

    console.log('Starting Tax Management migration...');

    try {
        // 1. Add columns to quotation_items
        const [columns] = await connection.execute("SHOW COLUMNS FROM quotation_items LIKE 'tax_mode'");
        if (columns.length === 0) {
            await connection.execute(`
                ALTER TABLE quotation_items
                ADD COLUMN tax_mode ENUM('none', 'add', 'deduct') DEFAULT 'none',
                ADD COLUMN tax_percentage DECIMAL(5, 2) DEFAULT 0.00,
                ADD COLUMN tax_amount DECIMAL(15, 2) DEFAULT 0.00,
                ADD COLUMN subtotal_amount DECIMAL(15, 2) DEFAULT 0.00
            `);
            console.log("Added tax columns to quotation_items.");
        } else {
            console.log("Tax columns already exist.");
        }

        // 2. Add default tax setting
        await connection.execute(`
            INSERT IGNORE INTO settings (setting_key, setting_value) 
            VALUES ('default_tax_percentage', '0')
        `);
        console.log("Added default_tax_percentage setting.");

        // 3. Backfill subtotal for existing items (assuming current total is subtotal as tax was none)
        await connection.execute(`
            UPDATE quotation_items 
            SET subtotal_amount = total_amount 
            WHERE subtotal_amount = 0 AND total_amount > 0
        `);
        console.log("Backfilled subtotal_amount.");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
