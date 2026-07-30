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
    console.log(`Starting migration for ${dbLabel}...`);
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log(`Connected to ${dbLabel}.`);

        // Check existing columns
        const [columns] = await connection.execute("SHOW COLUMNS FROM job_tasks");
        const existingFields = columns.map(c => c.Field.toLowerCase());

        const newColumns = [
            { name: 'actual_sheets_printed', type: 'DECIMAL(12,2) NULL' },
            { name: 'actual_sheets_wasted', type: 'DECIMAL(12,2) NULL' },
            { name: 'actual_plates_used', type: 'INT NULL' },
            { name: 'downtime_minutes', type: 'INT NULL' },
            { name: 'downtime_reason', type: 'VARCHAR(255) NULL' }
        ];

        for (const col of newColumns) {
            if (existingFields.includes(col.name)) {
                console.log(`Column '${col.name}' already exists in job_tasks table for ${dbLabel}.`);
            } else {
                console.log(`Adding column '${col.name}' to job_tasks table for ${dbLabel}...`);
                await connection.execute(`ALTER TABLE job_tasks ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Successfully added column '${col.name}' to ${dbLabel}.`);
            }
        }

    } catch (e) {
        console.error(`Error during migration of ${dbLabel}:`, e);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function main() {
    try {
        await migrateConnection(db1Config, 'Company 1 Database');
        console.log('--------------------------------------------------');
        await migrateConnection(db2Config, 'Company 2 Database');
        console.log('Migration process finished.');
        process.exit(0);
    } catch (err) {
        console.error('Migration execution failed:', err);
        process.exit(1);
    }
}

main();
