import pool from './lib/db.js';
async function run() {
    try {
        await pool.query('ALTER TABLE quotation_item_details ADD COLUMN type VARCHAR(50) DEFAULT "offset"');
        await pool.query('ALTER TABLE quotation_item_details ADD COLUMN paper_width_cm DECIMAL(10,2) DEFAULT NULL');
        await pool.query('ALTER TABLE quotation_item_details ADD COLUMN paper_height_cm DECIMAL(10,2) DEFAULT NULL');
        await pool.query('ALTER TABLE quotation_item_details ADD COLUMN digital_price_per_sq_cm DECIMAL(15,4) DEFAULT NULL');
        await pool.query('ALTER TABLE quotation_item_details ADD COLUMN color_quality VARCHAR(50) DEFAULT NULL');
        console.log("Migration successful");
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
