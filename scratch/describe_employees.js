import pool from '../lib/db.js';

async function describeEmployees() {
  try {
    const [rows] = await pool.execute('DESCRIBE employees');
    console.log('Employees schema:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

describeEmployees();
