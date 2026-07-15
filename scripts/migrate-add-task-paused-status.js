const mysql = require('mysql2/promise');
require('dotenv').config();

// Config for Company 1 (Primary)
const db1Config = {
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

// Config for Company 2 (AWS TiDB)
const db2Config = {
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

async function migrateConnection(config, dbLabel) {
    console.log(`Running migration for ${dbLabel}...`);
    const connection = await mysql.createConnection(config);
    try {
        await connection.execute(`
            ALTER TABLE job_tasks MODIFY COLUMN status ENUM('pending','in_progress','paused','done') DEFAULT 'pending'
        `);
        console.log(`Successfully modified status column enum values on ${dbLabel}.`);
    } catch (e) {
        console.error(`Error migrating ${dbLabel}:`, e);
    } finally {
        await connection.end();
    }
}

async function main() {
    try {
        await migrateConnection(db1Config, 'Company 1 Database');
        await migrateConnection(db2Config, 'Company 2 Database');
        console.log('Migration finished.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

main();
