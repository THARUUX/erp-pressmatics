import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  }
});

async function run() {
    try {
        const [items] = await pool.execute("SELECT id, customer_name, estimation_name, total_amount, created_at FROM quotation_items ORDER BY id DESC LIMIT 5");
        console.log("RECENT ITEMS:", items);
        for (const item of items) {
            const [details] = await pool.execute("SELECT id, component_name, type, final_finishing_cost FROM quotation_item_details WHERE quotation_item_id = ?", [item.id]);
            console.log(`DETAILS FOR ITEM ${item.id}:`, details);
            for (const det of details) {
                const [sfgs] = await pool.execute("SELECT id, item_name, quantity, total_price FROM quotation_item_sfg_lines WHERE quotation_item_detail_id = ?", [det.id]);
                console.log(`  SFGS FOR DETAIL ${det.id}:`, sfgs);
            }
        }
    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}

run();
