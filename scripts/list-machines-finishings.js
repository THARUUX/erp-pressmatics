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

async function run() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [machines] = await connection.execute('SELECT id, name, type FROM machines');
        const [finishings] = await connection.execute('SELECT id, name FROM finishings');
        console.log('Machines:', machines);
        console.log('Finishings:', finishings);
    } catch (e) {
        console.error(e);
    } finally {
        if (connection) await connection.end();
    }
}
run();
