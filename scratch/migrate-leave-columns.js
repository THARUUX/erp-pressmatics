import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool1Config = {
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

const pool2Config = {
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

async function migratePool(name, config) {
    console.log(`Migrating pool: ${name}...`);
    try {
        const connection = await mysql.createConnection(config);

        // Check if columns exist
        const [columns] = await connection.execute('DESCRIBE employees');
        const hasLimit = columns.some(c => c.Field === 'leave_limit');
        const hasRemaining = columns.some(c => c.Field === 'remaining_leaves');

        if (!hasLimit) {
            console.log(`Adding leave_limit to ${name}...`);
            await connection.execute('ALTER TABLE employees ADD COLUMN leave_limit INT DEFAULT 21');
        } else {
            console.log(`leave_limit already exists on ${name}`);
        }

        if (!hasRemaining) {
            console.log(`Adding remaining_leaves to ${name}...`);
            await connection.execute('ALTER TABLE employees ADD COLUMN remaining_leaves INT DEFAULT 21');
        } else {
            console.log(`remaining_leaves already exists on ${name}`);
        }

        await connection.end();
        console.log(`Migration of ${name} completed successfully!\n`);
    } catch (err) {
        console.error(`Migration of ${name} failed:`, err);
    }
}

async function main() {
    await migratePool('Company 1', pool1Config);
    await migratePool('Company 2', pool2Config);
    process.exit(0);
}

main();
