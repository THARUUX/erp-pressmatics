const mysql = require('mysql2/promise');
require('dotenv').config();

const db1Config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false,
  },
};

const db2Config = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2Db1nUiVftFh5mM.root',
  password: 'N8QPZ4x1VFYzaUq9',
  database: 'erp_press',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false,
  },
};

async function migrateDb(config, name) {
    let connection;
    try {
        console.log(`Migrating ${name}...`);
        connection = await mysql.createConnection(config);
        await connection.query(`
            ALTER TABLE sales_orders
            ADD COLUMN kanban_position INT NULL;
        `);
        console.log(`Successfully added kanban_position to ${name}.`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME' || e.message.includes('Duplicate column name')) {
            console.log(`kanban_position already exists in ${name}.`);
        } else {
            console.error(`Failed to migrate ${name}:`, e);
        }
    } finally {
        if (connection) await connection.end();
    }
}

async function main() {
    await migrateDb(db1Config, 'Company 1 (Local/configured)');
    await migrateDb(db2Config, 'Company 2 (TiDB Cloud)');
    process.exit(0);
}

main().catch(console.error);
