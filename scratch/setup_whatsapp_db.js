const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runSetup() {
    try {
        console.log('Connecting to database...');
        console.log('Host:', process.env.DB_HOST);
        console.log('Database:', process.env.DB_DATABASE);

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

        console.log('Connected. Running CREATE TABLE queries...');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              session_id    VARCHAR(255) NOT NULL,
              data_id       VARCHAR(255) NOT NULL,
              data_json     LONGTEXT NOT NULL,
              updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_session_data (session_id, data_id)
            )
        `);
        console.log('whatsapp_sessions table verified/created.');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_messages (
              id             VARCHAR(255) PRIMARY KEY,
              chat_id        VARCHAR(100) NOT NULL,
              from_me        TINYINT NOT NULL DEFAULT 0,
              sender_name    VARCHAR(255),
              message_body   TEXT,
              message_type   VARCHAR(50) NOT NULL DEFAULT 'text',
              media_mime     VARCHAR(100),
              media_filename VARCHAR(255),
              status         VARCHAR(50) DEFAULT 'received',
              sent_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_chat_id (chat_id),
              INDEX idx_sent_at (sent_at)
            )
        `);
        console.log('whatsapp_messages table verified/created.');

        await connection.end();
        console.log('Database setup completed successfully.');
    } catch (err) {
        console.error('Failed to setup database:', err);
    }
}

runSetup();
