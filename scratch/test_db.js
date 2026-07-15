const pool = require('../lib/db').default;

async function run() {
    try {
        const [rows] = await pool.execute("DESCRIBE quotation_item_sfg_lines");
        console.log("SCHEMA:", rows);
        const [recent] = await pool.execute("SELECT * FROM quotation_item_sfg_lines ORDER BY id DESC LIMIT 5");
        console.log("RECENT ENTRIES:", recent);
    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}

run();
