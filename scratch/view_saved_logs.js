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
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
};

async function viewLogs() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute('SELECT * FROM zkteco_attendance_logs ORDER BY timestamp DESC LIMIT 5');
    console.log('Saved Logs (last 5):');
    rows.forEach(r => {
      console.log(`ID: ${r.id}, UserID: ${r.device_user_id}, Timestamp: ${r.timestamp}, CreatedAt: ${r.created_at}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

viewLogs();
