const mysql = require('mysql2/promise');

async function migrate() {
    let connection;
    try {
        console.log('Migrating database: Adding code to quotation_items...');

        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press'
        });

        // 1. Add 'code' column
        try {
            await connection.query(`
                ALTER TABLE quotation_items
                ADD COLUMN code VARCHAR(50) AFTER id;
            `);
            console.log('Column code added.');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
            console.log('Column code already exists.');
        }

        // 2. Ensure settings keys exist
        // Check if settings table exists first? It should.
        // Insert defaults if not present.
        // Assuming table structure: setting_key (PK), setting_value
        // Or similar. Let's check schema if code fails, but INSERT IGNORE or ON DUPLICATE KEY UPDATE is safe.

        // Wait, I need to know settings table schema.
        // Usually it's key/value.
        // based on previous logs: "app/api/settings/route.js"

        await connection.query(`
            INSERT IGNORE INTO settings (setting_key, setting_value) 
            VALUES 
            ('item_code_template', 'EST-{0000}'),
            ('item_code_seq', '1000');
        `);
        console.log('Settings defaults ensured.');

        // 3. Backfill existing items if code is empty
        const [items] = await connection.query('SELECT id FROM quotation_items WHERE code IS NULL OR code = "" ORDER BY id ASC');
        if (items.length > 0) {
            console.log(`Backfilling ${items.length} existing items...`);
            let seq = 1000;
            for (const item of items) {
                const code = `EST-${String(seq).padStart(4, '0')}`;
                await connection.query('UPDATE quotation_items SET code = ? WHERE id = ?', [code, item.id]);
                seq++;
            }
            // Update sequence in settings to match next available
            await connection.query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [String(seq), 'item_code_seq']);
            console.log(`Backfill complete. Next seq: ${seq}`);
        }

        console.log('Migration successful.');
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        if (connection) await connection.end();
        process.exit(1);
    }
}

migrate();
