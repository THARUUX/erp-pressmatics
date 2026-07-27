const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig1 = {
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

const dbConfig2 = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2Db1nUiVftFh5mM.root',
  password: 'N8QPZ4x1VFYzaUq9',
  database: 'erp_press',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  }
};

async function run() {
  for (const [name, config] of [['Company 1', dbConfig1], ['Company 2', dbConfig2]]) {
    console.log(`Checking database ${name}...`);
    let conn;
    try {
      conn = await mysql.createConnection(config);
      const [columns] = await conn.execute('DESCRIBE machines');
      const hasCol = columns.some(col => col.Field === 'setup_minutes_per_plate');
      
      if (!hasCol) {
        console.log(`Adding setup_minutes_per_plate column to machines table in ${name}...`);
        await conn.execute('ALTER TABLE machines ADD COLUMN setup_minutes_per_plate INT DEFAULT 0');
        console.log(`Column added successfully to ${name}.`);
      } else {
        console.log(`Column already exists in ${name}.`);
      }
    } catch (err) {
      console.error(`Error on database ${name}:`, err.message);
    } finally {
      if (conn) await conn.end();
    }
  }
}

run();
