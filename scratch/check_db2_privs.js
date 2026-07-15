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
    
    const [databases] = await connection.query('SHOW DATABASES');
    console.log('Databases:', databases.map(d => Object.values(d)[0]));

    const [grants] = await connection.query('SHOW GRANTS');
    console.log('Grants:', grants.map(g => Object.values(g)[0]));

    await connection.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
