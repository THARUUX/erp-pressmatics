import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
};

async function runMigration() {
  console.log('🚀 Running fingerprint database migrations...');
  console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}...`);
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // 1. Create mapping table
    console.log('Creating `employee_zkteco_mapping` table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS employee_zkteco_mapping (
        device_user_id VARCHAR(50) PRIMARY KEY,
        employee_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table `employee_zkteco_mapping` created successfully.');

    // 2. Create attendance logs table
    console.log('Creating `zkteco_attendance_logs` table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zkteco_attendance_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_user_id VARCHAR(50) NOT NULL,
        timestamp DATETIME NOT NULL,
        state INT NOT NULL DEFAULT 0,
        verification_type INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_device_time (device_user_id, timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table `zkteco_attendance_logs` created successfully.');
    
    console.log('🎉 Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
