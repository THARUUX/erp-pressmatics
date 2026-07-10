import pool from '../lib/db.js';

async function listTables() {
  try {
    const [rows] = await pool.execute('SHOW TABLES');
    console.log('Tables:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

listTables();
