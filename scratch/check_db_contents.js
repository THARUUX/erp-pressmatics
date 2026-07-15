const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkDb() {
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

        const [sessions] = await connection.execute('SELECT COUNT(*) as count FROM whatsapp_sessions');
        console.log(`Total sessions/keys in DB: ${sessions[0].count}`);

        const [creds] = await connection.execute("SELECT data_id, CHAR_LENGTH(data_json) as length FROM whatsapp_sessions WHERE data_id = 'creds.json'");
        if (creds.length > 0) {
            console.log(`Creds row found! data_id: ${creds[0].data_id}, data_json length: ${creds[0].length}`);
        } else {
            console.log('Creds row NOT found in DB.');
        }

        const [messages] = await connection.execute('SELECT COUNT(*) as count FROM whatsapp_messages');
        console.log(`Total logged messages in DB: ${messages[0].count}`);

        await connection.end();
    } catch (err) {
        console.error('Failed to query DB:', err);
    }
}

checkDb();
