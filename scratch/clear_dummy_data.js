import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function clearDummy() {
  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    }
  };

  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('Fetching current logs and mappings...');
    const [logs] = await connection.execute('SELECT * FROM zkteco_attendance_logs');
    console.log(`Found ${logs.length} total logs.`);
    
    const [mappings] = await connection.execute('SELECT * FROM employee_zkteco_mapping');
    console.log(`Found ${mappings.length} mappings:`, mappings);

    // Truncate logs
    console.log('Truncating zkteco_attendance_logs...');
    await connection.execute('TRUNCATE TABLE zkteco_attendance_logs');
    console.log('Logs truncated.');

    // We can also clear mappings that have dummy device IDs (like '101', '102', '103', '104')
    console.log('Deleting dummy mappings (IDs 101, 102, 103, 104)...');
    await connection.execute(`
      DELETE FROM employee_zkteco_mapping 
      WHERE device_user_id IN ('101', '102', '103', '104', '105')
    `);
    console.log('Dummy mappings deleted.');
  } catch (err) {
    console.error('Error clearing dummy data:', err);
  } finally {
    await connection.end();
  }
}

clearDummy();
