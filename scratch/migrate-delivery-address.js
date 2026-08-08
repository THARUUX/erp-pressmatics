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

        // Check if column exists
        const [columns] = await connection.execute('DESCRIBE deliveries');
        const hasAddress = columns.some(c => c.Field === 'delivery_address');

        if (!hasAddress) {
            console.log(`Adding delivery_address to ${name}...`);
            await connection.execute('ALTER TABLE deliveries ADD COLUMN delivery_address TEXT');
            console.log(`Column delivery_address added successfully to ${name}`);
        } else {
            console.log(`delivery_address already exists on ${name}`);
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
