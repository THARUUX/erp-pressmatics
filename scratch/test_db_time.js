import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  dateStrings: true, // Return all date columns as strings
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
};

async function testTime() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute('SELECT MAX(timestamp) as max_time, MAX(created_at) as last_uploaded FROM zkteco_attendance_logs');
    console.log('max_time:', rows[0].max_time, 'type:', typeof rows[0].max_time);
    console.log('last_uploaded:', rows[0].last_uploaded, 'type:', typeof rows[0].last_uploaded);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

testTime();
