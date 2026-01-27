const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press'
        });
        console.log('Successfully connected to the database.');
        await connection.end();
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
}

testConnection();
