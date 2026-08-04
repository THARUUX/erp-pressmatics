import mysql from 'mysql2/promise';
import 'dotenv/config';

// Connection Pool 1 (Company 1 - Primary)
const pool1 = mysql.createPool({
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

// Connection Pool 2 (Company 2)
const pool2 = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2Db1nUiVftFh5mM.root',
  password: 'N8QPZ4x1VFYzaUq9',
  database: 'erp_press',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
});

async function searchDatabase(pool, label) {
  console.log(`=== Searching ${label} ===`);
  try {
    // List tables
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    
    for (const table of tableNames) {
      // Find columns that are of string type
      const [columns] = await pool.query(`DESCRIBE \`${table}\``);
      const textCols = columns
        .filter(c => c.Type.includes('char') || c.Type.includes('text') || c.Type.includes('varchar'))
        .map(c => c.Field);
      
      if (textCols.length === 0) continue;
      
      // Construct a query to see if any text column contains ST-1220 or ST-1240
      const conditions = [];
      const params = [];
      for (const col of textCols) {
        conditions.push(`\`${col}\` LIKE ?`);
        params.push('%ST-1220%');
        conditions.push(`\`${col}\` LIKE ?`);
        params.push('%ST-1240%');
      }
      
      const query = `SELECT * FROM \`${table}\` WHERE ${conditions.join(' OR ')} LIMIT 10`;
      const [rows] = await pool.query(query, params);
      if (rows.length > 0) {
        console.log(`Found matching row(s) in table [${table}]:`);
        console.log(JSON.stringify(rows, null, 2));
      }
    }
  } catch (err) {
    console.error(`Error searching ${label}:`, err);
  }
}

async function main() {
  await searchDatabase(pool1, 'Company 1');
  await searchDatabase(pool2, 'Company 2');
  process.exit(0);
}

main();
