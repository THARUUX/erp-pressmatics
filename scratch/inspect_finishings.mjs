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
        const [finishings] = await pool.execute("SELECT * FROM quotation_item_finishings WHERE quotation_item_detail_id = 4230899");
        console.log("FINISHINGS FOR DETAIL 4230899:", finishings);
    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}

run();
