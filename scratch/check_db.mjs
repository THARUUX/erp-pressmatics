import pool from '../lib/db.js';

async function main() {
    try {
        console.log("Checking quotations table schema...");
        const [columns] = await pool.execute("DESCRIBE quotations");
        console.log("Quotations Columns:", columns);

        const [lineColumns] = await pool.execute("DESCRIBE quotation_line_items");
        console.log("Quotation Line Items Columns:", lineColumns);

        const [itemsColumns] = await pool.execute("DESCRIBE quotation_items");
        console.log("Quotation Items Columns:", itemsColumns);

        const [settings] = await pool.execute("SELECT * FROM settings WHERE setting_key IN ('quotation_id_template', 'quotation_id_seq')");
        console.log("Settings:", settings);

        // Fetch a few rows if they exist
        const [recent] = await pool.execute("SELECT * FROM quotations ORDER BY id DESC LIMIT 2");
        console.log("Recent Quotations:", recent);

    } catch (err) {
        console.error("Database query failed:", err);
    } finally {
        process.exit();
    }
}

main();
