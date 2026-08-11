const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateCommonResources() {
  console.log('Starting migration for Common Resources across Company 1 and Company 2...');

  const config1 = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  };

  const config2 = {
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2Db1nUiVftFh5mM.root',
    password: 'N8QPZ4x1VFYzaUq9',
    database: 'erp_press',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  };

  const pools = [
    { name: 'Company 1', config: config1 },
    { name: 'Company 2', config: config2 },
  ];

  for (const { name, config } of pools) {
    console.log(`\nConnecting to ${name}...`);
    let conn;
    try {
      conn = await mysql.createConnection(config);

      // 1. Add is_common to machines table if not exists
      const [machineCols] = await conn.execute("SHOW COLUMNS FROM machines LIKE 'is_common'");
      if (machineCols.length === 0) {
        await conn.execute("ALTER TABLE machines ADD COLUMN is_common TINYINT(1) NOT NULL DEFAULT 0");
        console.log(`  [+] Added 'is_common' column to 'machines' in ${name}`);
      } else {
        console.log(`  [=] Column 'is_common' already exists in 'machines' (${name})`);
      }

      // 2. Add is_common to services table if not exists
      const [serviceCols] = await conn.execute("SHOW COLUMNS FROM services LIKE 'is_common'");
      if (serviceCols.length === 0) {
        await conn.execute("ALTER TABLE services ADD COLUMN is_common TINYINT(1) NOT NULL DEFAULT 0");
        console.log(`  [+] Added 'is_common' column to 'services' in ${name}`);
      } else {
        console.log(`  [=] Column 'is_common' already exists in 'services' (${name})`);
      }

      // 3. Add service_id to job_tasks table if not exists
      const [taskServiceCols] = await conn.execute("SHOW COLUMNS FROM job_tasks LIKE 'service_id'");
      if (taskServiceCols.length === 0) {
        await conn.execute("ALTER TABLE job_tasks ADD COLUMN service_id INT DEFAULT NULL");
        console.log(`  [+] Added 'service_id' column to 'job_tasks' in ${name}`);
      } else {
        console.log(`  [=] Column 'service_id' already exists in 'job_tasks' (${name})`);
      }

      // 4. Add is_common to task_configurations or finishing tables if exists
      const [tables] = await conn.execute("SHOW TABLES LIKE 'finishing_options'");
      if (tables.length > 0) {
        const [finCols] = await conn.execute("SHOW COLUMNS FROM finishing_options LIKE 'is_common'");
        if (finCols.length === 0) {
          await conn.execute("ALTER TABLE finishing_options ADD COLUMN is_common TINYINT(1) NOT NULL DEFAULT 0");
          console.log(`  [+] Added 'is_common' column to 'finishing_options' in ${name}`);
        }
      }

    } catch (err) {
      console.error(`Migration error for ${name}:`, err.message);
    } finally {
      if (conn) await conn.end();
    }
  }

  console.log('\nMigration complete.');
}

migrateCommonResources();
