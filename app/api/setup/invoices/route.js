import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ONE-TIME SETUP: GET /api/setup/invoices
// Delete this file after running once.
export async function GET() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS invoices (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                code          VARCHAR(50) UNIQUE,
                quotation_id  INT NULL,
                customer_id   INT NULL,
                customer_name VARCHAR(255),
                description   TEXT,
                amount_due    DECIMAL(12,2) NOT NULL DEFAULT 0,
                amount_paid   DECIMAL(12,2) NOT NULL DEFAULT 0,
                status        ENUM('draft','sent','partial','paid','overdue') DEFAULT 'draft',
                due_date      DATE NULL,
                notes         TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS invoice_payments (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id  INT NOT NULL,
                amount      DECIMAL(12,2) NOT NULL,
                method      VARCHAR(50) DEFAULT 'Cash',
                reference   VARCHAR(255),
                paid_at     DATE NOT NULL,
                notes       TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            )
        `);

        return NextResponse.json({ success: true, message: 'invoices + invoice_payments tables created.' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
