const mysql = require('mysql2/promise');
require('dotenv').config();

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
  console.log('🚀 Starting payroll system database migrations...');
  console.log(`Connecting to database at ${dbConfig.host}:${dbConfig.port}...`);

  const connection = await mysql.createConnection(dbConfig);

  try {
    // 1. Add payroll configuration columns to employees table
    console.log('Adding payroll columns to `employees` table...');
    const alterColumns = [
      { name: 'pay_type', type: "VARCHAR(20) DEFAULT 'monthly'" },
      { name: 'base_salary', type: 'DECIMAL(15, 2) DEFAULT 0.00' },
      { name: 'hourly_rate', type: 'DECIMAL(15, 2) DEFAULT 0.00' },
      { name: 'allowances', type: 'DECIMAL(15, 2) DEFAULT 0.00' },
      { name: 'deductions', type: 'DECIMAL(15, 2) DEFAULT 0.00' },
      { name: 'ot_rate_multiplier', type: 'DECIMAL(5, 2) DEFAULT 1.50' },
      { name: 'standard_working_hours', type: 'DECIMAL(5, 2) DEFAULT 8.00' }
    ];

    for (const col of alterColumns) {
      try {
        await connection.execute(`ALTER TABLE employees ADD COLUMN ${col.name} ${col.type}`);
        console.log(`  ✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
          console.log(`  ℹ️ Column ${col.name} already exists. Skipping.`);
        } else {
          throw err;
        }
      }
    }

    // 2. Create payroll_runs table
    console.log('Creating `payroll_runs` table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        year INT NOT NULL,
        month INT NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_year_month (year, month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table `payroll_runs` created/verified.');

    // 3. Create payslips table
    console.log('Creating `payslips` table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payslips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payroll_run_id INT NOT NULL,
        employee_id INT NOT NULL,
        pay_type VARCHAR(20) NOT NULL,
        base_salary DECIMAL(15, 2) NOT NULL,
        hourly_rate DECIMAL(15, 2) NOT NULL,
        total_hours_worked DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        overtime_hours DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        overtime_pay DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        allowances DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        deductions DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        net_pay DECIMAL(15, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE KEY uq_run_employee (payroll_run_id, employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table `payslips` created/verified.');

    console.log('🎉 Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
