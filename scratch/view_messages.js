const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function viewMessages() {
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

        const [messages] = await connection.execute('SELECT * FROM whatsapp_messages');
        console.log('Logged Messages:');
        console.log(JSON.stringify(messages, null, 2));

        await connection.end();
    } catch (err) {
        console.error('Failed to query messages:', err);
    }
}

viewMessages();
