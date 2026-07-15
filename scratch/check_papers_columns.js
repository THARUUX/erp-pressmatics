const mysql = require('mysql2/promise');
require('dotenv').config();

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
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [columns] = await connection.query('DESCRIBE papers');
        console.log('PAPERS COLUMNS:', columns);
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

main();
