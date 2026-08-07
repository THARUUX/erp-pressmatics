import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '4000', 10),
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true,
            }
        });

        console.log('--- EMPLOYEES SCHEMA ---');
        const [empCols] = await connection.execute('DESCRIBE employees');
        console.log(empCols);

        console.log('\n--- LEAVES SCHEMA ---');
        const [leaveCols] = await connection.execute('DESCRIBE leaves');
        console.log(leaveCols);

        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
