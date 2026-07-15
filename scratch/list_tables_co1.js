const mysql = require('mysql2/promise');

async function test() {
  console.log('Connecting to Company 1 database...');
  try {
    const connection = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com',
      port: 4000,
      user: 'urodvqgtAbDHKxM.root',
      password: 'beZ9NcUqVGbRV2nw',
      database: 'erp_press',
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      }
    });
    console.log('Connected successfully!');
    const [rows] = await connection.query('SHOW TABLES');
    console.log('Tables in erp_press database:', rows.map(r => Object.values(r)[0]));
    await connection.end();
  } catch (err) {
    console.error('Error connecting to Company 1 database:', err);
  }
}

test();
