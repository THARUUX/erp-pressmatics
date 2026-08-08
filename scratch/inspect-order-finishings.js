const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
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

    const orderId = 1170020;
    const [rows] = await pool.execute(`
        SELECT qif.*, qi.quantity AS item_qty
        FROM quotation_item_finishings qif
        JOIN quotation_items qi ON qif.quotation_item_id = qi.id
        JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
        JOIN sales_orders so ON so.quotation_id = qli.quotation_id
        WHERE so.id = ?
    `, [orderId]);
    console.log(JSON.stringify(rows, null, 2));
    await pool.end();
}

run().catch(console.error);
