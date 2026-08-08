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
        console.log('Creating job_task_work_logs table if not exists...');
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS job_task_work_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id INT NOT NULL,
                employee_name VARCHAR(255) NOT NULL,
                started_at DATETIME NOT NULL,
                stopped_at DATETIME NULL,
                duration_seconds INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_task (task_id),
                INDEX idx_employee (employee_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Successfully created/verified job_task_work_logs table.');
    } catch (e) {
        console.error('Error creating table:', e);
    } finally {
        process.exit();
    }
}
main();
