const mysql = require('mysql2/promise');

async function syncSchema() {
  console.log('Starting schema synchronization from Company 1 to Company 2...');

  let sourceConn, targetConn;

  try {
    // 1. Connect to Source (Company 1)
    sourceConn = await mysql.createConnection({
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
    console.log('Connected to Source Database (Company 1).');

    // 2. Connect to Target (Company 2)
    targetConn = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '2Db1nUiVftFh5mM.root',
      password: 'N8QPZ4x1VFYzaUq9',
      database: 'erp_press',
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      }
    });
    console.log('Connected to Target Database (Company 2 - erp_press).');

    // Disable foreign key checks on target to safely recreate tables
    await targetConn.execute('SET foreign_key_checks = 0');
    console.log('Disabled foreign key checks on Target.');

    // 3. Fetch all tables from Source
    const [tablesRows] = await sourceConn.query('SHOW TABLES');
    const tableNames = tablesRows.map(r => Object.values(r)[0]);
    console.log(`Found ${tableNames.length} tables in Source Database.`);

    // 4. Retrieve CREATE TABLE queries from Source and run them on Target
    for (const tableName of tableNames) {
      console.log(`Cloning table structure: ${tableName}...`);

      // Drop target table if exists
      await targetConn.execute(`DROP TABLE IF EXISTS \`${tableName}\``);

      // Get create statement
      const [createRows] = await sourceConn.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createSql = createRows[0]['Create Table'];

      // Execute on Target
      await targetConn.execute(createSql);
    }

    // Re-enable foreign key checks
    await targetConn.execute('SET foreign_key_checks = 1');
    console.log('Re-enabled foreign key checks on Target.');

    console.log('Schema synchronization completed successfully!');

  } catch (error) {
    console.error('Schema synchronization failed:', error);
  } finally {
    if (sourceConn) await sourceConn.end();
    if (targetConn) await targetConn.end();
  }
}

syncSchema();
