const mysql = require('mysql2/promise');

async function test() {
  console.log('Connecting to Company 2 database...');
  try {
    const connection = await mysql.createConnection({
      uri: 'mysql://2Db1nUiVftFh5mM.root:N8QPZ4x1VFYzaUq9@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/sys',
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      }
    });
    console.log('Connected successfully!');
    const [rows] = await connection.query('SHOW TABLES');
    console.log('Tables in sys database:', rows);
    await connection.end();
  } catch (err) {
    console.error('Error connecting to Company 2 database:', err);
  }
}

test();
