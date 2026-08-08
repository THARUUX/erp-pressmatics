import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: '+00:00',
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
});

async function main() {
    try {
        const [cols] = await pool.execute('DESCRIBE job_tasks');
        console.log('--- JOB_TASKS COLUMNS ---');
        console.table(cols.map(c => ({ Field: c.Field, Type: c.Type })));

        const [tables] = await pool.execute('SHOW TABLES LIKE "%task%"');
        console.log('--- TASK TABLES ---', tables);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
main();
