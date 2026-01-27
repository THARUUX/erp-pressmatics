const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'erp_press'
    });

    console.log('Starting Document Layout migration...');

    try {
        // 1. Add terms_and_conditions to quotations
        const [columns] = await connection.execute("SHOW COLUMNS FROM quotations LIKE 'terms_and_conditions'");
        if (columns.length === 0) {
            await connection.execute(`
                ALTER TABLE quotations
                ADD COLUMN terms_and_conditions TEXT
            `);
            console.log("Added terms_and_conditions to quotations.");
        } else {
            console.log("terms_and_conditions column already exists.");
        }

        // 2. Add default company settings
        const settingsToAdd = [
            ['company_name', 'Pressmatics Printing'],
            ['company_address', '123 Print Street, Digital City'],
            ['company_logo', ''],
            ['company_signature', ''],
            ['default_terms', '1. Valid for 30 days.\n2. 50% Advance payment required.']
        ];

        for (const [key, val] of settingsToAdd) {
            await connection.execute(`
                INSERT IGNORE INTO settings (setting_key, setting_value) 
                VALUES (?, ?)
            `, [key, val]);
        }
        console.log("Added default company settings.");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
