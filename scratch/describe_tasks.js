const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'erp_press',
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
    }
};

async function inspect() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const [rows] = await connection.execute("DESCRIBE job_tasks");
        console.table(rows);

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

inspect();
