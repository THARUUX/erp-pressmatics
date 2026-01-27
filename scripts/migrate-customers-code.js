const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'erp_press'
    });

    console.log('Starting Customer Code migration...');

    try {
        // 1. Add columns to customers
        try {
            await connection.execute("ALTER TABLE customers ADD COLUMN code VARCHAR(50) AFTER id");
            console.log("Added 'code' column to customers.");
        } catch (e) {
            console.log("'code' column likely exists or error:", e.message);
        }

        // 2. Ensure settings exist (just in case)
        await connection.execute(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('customer_id_template', 'CUST-{000}'), ('customer_id_seq', '1')`);

        // 3. Backfill existing customers
        const [customers] = await connection.execute("SELECT id FROM customers WHERE code IS NULL");
        for (const c of customers) {
            const code = `CUST-${String(c.id).padStart(3, '0')}`;
            await connection.execute("UPDATE customers SET code = ? WHERE id = ?", [code, c.id]);
            console.log(`Backfilled Customer #${c.id} with code ${code}`);
        }

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
