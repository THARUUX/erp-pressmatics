import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
});

async function main() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log('Tables:', tableNames.join(', '));

    const ids = [4290087, 4320093]; // ST-1220 and ST-1240 ids in quotation_items
    
    // We want to query tables that might refer to these quotation items or estimations.
    // Let's query quotation_items first to see all columns
    const [quotationItems] = await pool.query('SELECT * FROM quotation_items WHERE id IN (?, ?)', ids);
    console.log('\n--- quotation_items ---');
    console.log(JSON.stringify(quotationItems, null, 2));

    // Let's see if there are other tables referencing these IDs or having names like *estimation*
    for (const tableName of tableNames) {
      if (tableName === 'quotation_items') continue;
      
      const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
      const hasQuotationItemId = columns.some(c => c.Field.toLowerCase() === 'quotation_item_id');
      const hasItemId = columns.some(c => c.Field.toLowerCase() === 'item_id');
      const hasCode = columns.some(c => c.Field.toLowerCase() === 'code');
      const hasRef = columns.some(c => c.Field.toLowerCase().includes('estim'));

      if (hasQuotationItemId) {
        const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE quotation_item_id IN (?, ?)`, ids);
        if (rows.length > 0) {
          console.log(`\n--- ${tableName} (by quotation_item_id) ---`);
          console.log(JSON.stringify(rows, null, 2));
        }
      }
      
      if (hasItemId) {
        const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE item_id IN (?, ?)`, ids);
        if (rows.length > 0) {
          console.log(`\n--- ${tableName} (by item_id) ---`);
          console.log(JSON.stringify(rows, null, 2));
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
