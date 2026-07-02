/**
 * Supplier Management Migration
 * Creates: suppliers, supplier_items, purchase_orders, purchase_order_items, supplier_payments
 * Run: node scripts/migrate_suppliers.js
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '4000', 10),
    user:     process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl:      { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit:    5,
});

async function run() {
    const conn = await pool.getConnection();
    try {
        console.log('🚀 Running Supplier Management migration...\n');

        // ── 1. suppliers ────────────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name            VARCHAR(255) NOT NULL,
                code            VARCHAR(50)  NOT NULL UNIQUE,
                email           VARCHAR(255) DEFAULT NULL,
                phone           VARCHAR(50)  DEFAULT NULL,
                address         TEXT         DEFAULT NULL,
                contact_name    VARCHAR(255) DEFAULT NULL,
                contact_phone   VARCHAR(50)  DEFAULT NULL,
                contact_email   VARCHAR(255) DEFAULT NULL,
                payment_terms   VARCHAR(100) DEFAULT 'Net 30',
                credit_limit    DECIMAL(15,2) DEFAULT 0.00,
                notes           TEXT         DEFAULT NULL,
                is_active       TINYINT(1)   NOT NULL DEFAULT 1,
                created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ suppliers table ready');

        // ── 2. supplier_items ────────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS supplier_items (
                id                  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                supplier_id         INT          NOT NULL,
                inventory_item_id   INT          DEFAULT NULL,
                item_name           VARCHAR(255) NOT NULL,
                sku                 VARCHAR(100) DEFAULT NULL,
                unit_price          DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
                uom                 VARCHAR(50)  DEFAULT 'Unit',
                min_order_qty       DECIMAL(12,4) DEFAULT 1,
                lead_time_days      INT          DEFAULT 0,
                notes               TEXT         DEFAULT NULL,
                is_active           TINYINT(1)   NOT NULL DEFAULT 1,
                created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ supplier_items table ready');

        // ── 3. purchase_orders ───────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                po_number       VARCHAR(50)  NOT NULL UNIQUE,
                supplier_id     INT          NOT NULL,
                order_date      DATE         NOT NULL,
                expected_date   DATE         DEFAULT NULL,
                status          VARCHAR(20)  NOT NULL DEFAULT 'draft',
                subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                paid_amount     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                notes           TEXT         DEFAULT NULL,
                created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
            )
        `);
        console.log('✅ purchase_orders table ready');

        // ── 4. purchase_order_items ──────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS purchase_order_items (
                id                  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                po_id               INT          NOT NULL,
                supplier_item_id    INT          DEFAULT NULL,
                inventory_item_id   INT          DEFAULT NULL,
                item_name           VARCHAR(255) NOT NULL,
                quantity            DECIMAL(12,4) NOT NULL DEFAULT 0,
                unit_price          DECIMAL(15,4) NOT NULL DEFAULT 0,
                total_price         DECIMAL(15,2) NOT NULL DEFAULT 0,
                received_qty        DECIMAL(12,4) NOT NULL DEFAULT 0,
                uom                 VARCHAR(50)  DEFAULT 'Unit',
                FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ purchase_order_items table ready');

        // ── 5. supplier_payments ─────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS supplier_payments (
                id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                supplier_id     INT          NOT NULL,
                po_id           INT          DEFAULT NULL,
                payment_date    DATE         NOT NULL,
                amount          DECIMAL(15,2) NOT NULL,
                method          VARCHAR(30)  NOT NULL DEFAULT 'bank_transfer',
                reference       VARCHAR(100) DEFAULT NULL,
                notes           TEXT         DEFAULT NULL,
                created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
                FOREIGN KEY (po_id)       REFERENCES purchase_orders(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ supplier_payments table ready');

        // ── Seed settings for PO sequence ───────────────────────────────
        await conn.execute(`
            INSERT IGNORE INTO settings (setting_key, setting_value)
            VALUES ('po_number_seq', '1'), ('po_number_template', 'PO-{0000}')
        `);
        console.log('✅ PO settings seeded');

        console.log('\n🎉 Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        conn.release();
        await pool.end();
    }
}

run();
