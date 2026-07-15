const mysql = require('mysql2/promise');

async function test() {
  console.log('Connecting to target database...');
  try {
    const connection = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '2Db1nUiVftFh5mM.root',
      password: 'N8QPZ4x1VFYzaUq9',
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      }
    });
    console.log('Connected successfully!');
    
    await connection.query('CREATE DATABASE IF NOT EXISTS `erp_press`');
    console.log('Database erp_press created successfully (or already existed)!');
    
    const [databases] = await connection.query('SHOW DATABASES');
    console.log('Updated Databases:', databases.map(d => Object.values(d)[0]));

    await connection.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
