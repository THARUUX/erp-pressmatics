const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });
    console.log('Connected.');

    await conn.execute(`
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
    console.log('✅ invoices table ready');

    await conn.execute(`
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
    console.log('✅ invoice_payments table ready');

    await conn.end();
    console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
