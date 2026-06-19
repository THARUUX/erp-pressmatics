import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/setup/vat — adds is_vat + vat_number to customers; adds company_vat_reg + default_invoice_notes to settings
export async function GET() {
    try {
        // Add is_vat column
        await pool.execute(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_vat TINYINT(1) NOT NULL DEFAULT 0`);
        // Add vat_number column
        await pool.execute(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS vat_number VARCHAR(100) NULL`);

        // Seed settings keys (ignore duplicates)
        await pool.execute(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('company_vat_reg', ''), ('default_invoice_notes', '')`);

        // Add invoice_notes column to invoices (for per-invoice T&C override)
        await pool.execute(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_notes TEXT NULL`);

        return NextResponse.json({ success: true, message: 'VAT columns + invoice_notes added.' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
