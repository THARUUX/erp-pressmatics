import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
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

async function main() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        console.log('--- deliveries ---');
        const [cols1] = await conn.execute('DESCRIBE deliveries');
        console.log(cols1.map(c => `${c.Field}: ${c.Type}`).join('\n'));

        console.log('\n--- delivery_dispatches ---');
        const [cols2] = await conn.execute('DESCRIBE delivery_dispatches');
        console.log(cols2.map(c => `${c.Field}: ${c.Type}`).join('\n'));

        console.log('\n--- sales_orders ---');
        const [cols3] = await conn.execute('DESCRIBE sales_orders');
        console.log(cols3.map(c => `${c.Field}: ${c.Type}`).join('\n'));
    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}
main();
