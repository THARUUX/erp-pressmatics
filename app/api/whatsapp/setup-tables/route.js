import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_quote_sends (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              quotation_id  INT NOT NULL,
              customer_phone VARCHAR(30) NOT NULL,
              sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_phone (customer_phone),
              INDEX idx_quote (quotation_id)
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_notifications (
              id              INT AUTO_INCREMENT PRIMARY KEY,
              from_number     VARCHAR(30) NOT NULL,
              message_body    TEXT,
              quotation_id    INT,
              quotation_code  VARCHAR(50),
              customer_name   VARCHAR(200),
              is_read         TINYINT DEFAULT 0,
              received_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_read (is_read),
              INDEX idx_quote (quotation_id)
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              session_id    VARCHAR(255) NOT NULL,
              data_id       VARCHAR(255) NOT NULL,
              data_json     LONGTEXT NOT NULL,
              updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_session_data (session_id, data_id)
            )
        `);

        await pool.execute(`
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

        return NextResponse.json({ success: true, message: 'Tables created/updated successfully' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
