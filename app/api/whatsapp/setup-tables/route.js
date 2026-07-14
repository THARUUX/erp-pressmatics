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

        return NextResponse.json({ success: true, message: 'Tables created' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
