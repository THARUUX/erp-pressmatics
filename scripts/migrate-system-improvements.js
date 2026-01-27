const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'erp_press'
    });

    console.log('Starting migration...');

    try {
        // 1. Add columns to quotations
        try {
            await connection.execute("ALTER TABLE quotations ADD COLUMN code VARCHAR(50) AFTER id");
            console.log("Added 'code' column to quotations.");
        } catch (e) {
            console.log("'code' column likely exists or error:", e.message);
        }

        // 2. Insert Default Settings if not exist
        const defaultSettings = [
            ['customer_id_template', 'CUST-{000}'],
            ['customer_id_seq', '1'],
            ['quotation_id_template', 'QTN-{0000}'],
            ['quotation_id_seq', '1'],
            ['list_item_limit', '10']
        ];

        for (const [key, value] of defaultSettings) {
            await connection.execute(
                `INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`,
                [key, value]
            );
        }
        console.log("Updated default settings.");

        // 3. Backfill existing quotations with code
        const [quotes] = await connection.execute("SELECT id FROM quotations WHERE code IS NULL");
        for (const q of quotes) {
            const code = `QTN-${String(q.id).padStart(4, '0')}`;
            await connection.execute("UPDATE quotations SET code = ? WHERE id = ?", [code, q.id]);
            console.log(`Backfilled Quote #${q.id} with code ${code}`);
        }

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
