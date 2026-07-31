const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig1 = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

const dbConfig2 = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2Db1nUiVftFh5mM.root',
  password: 'N8QPZ4x1VFYzaUq9',
  database: 'erp_press',
};

async function migratePool(name, config) {
  console.log(`\nConnecting to ${name}...`);
  let connection;
  try {
    connection = await mysql.createConnection({
      ...config,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      }
    });
    console.log(`Connected to ${name}. Running schema updates...`);

    // Helper function to add column if not exists
    const addColumnIfNotExist = async (table, column, definition) => {
      try {
        const [columns] = await connection.execute(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
        if (columns.length === 0) {
          console.log(`Adding column \`${column}\` to \`${table}\`...`);
          await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
          console.log(`Column \`${column}\` added successfully.`);
        } else {
          console.log(`Column \`${column}\` already exists in \`${table}\`.`);
        }
      } catch (err) {
        console.error(`Error checking/adding column \`${column}\` to \`${table}\`:`, err);
      }
    };

    // Update machines
    await addColumnIfNotExist('machines', 'assigned_helper_ids', 'JSON NULL');

    // Update finishings
    await addColumnIfNotExist('finishings', 'assigned_helper_ids', 'JSON NULL');

    // Update job_tasks
    await addColumnIfNotExist('job_tasks', 'helper_name', 'VARCHAR(255) NULL');
    await addColumnIfNotExist('job_tasks', 'completed_by_helper', 'VARCHAR(255) NULL');

    console.log(`Schema updates completed for ${name}.`);
  } catch (error) {
    console.error(`Migration failed for ${name}:`, error);
  } finally {
    if (connection) await connection.end();
  }
}

async function main() {
  await migratePool('Company 1 (Primary)', dbConfig1);
  await migratePool('Company 2', dbConfig2);
}

main();
