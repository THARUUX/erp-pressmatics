import pool from './lib/db.js';
async function run() {
    const [rows] = await pool.query('DESCRIBE quotation_item_details');
    console.log(rows);
    process.exit(0);
}
run();
