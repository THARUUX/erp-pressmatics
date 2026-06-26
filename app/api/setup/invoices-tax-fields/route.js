import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ONE-TIME MIGRATION: GET /api/setup/invoices-tax-fields
// Adds subtotal_amount, tax_amount, tax_percentage to invoices table.
export async function GET() {
    try {
        await pool.execute(`
            ALTER TABLE invoices
            ADD COLUMN IF NOT EXISTS subtotal_amount  DECIMAL(12,2) NULL DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS tax_amount       DECIMAL(12,2) NULL DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS tax_percentage   DECIMAL(5,2)  NULL DEFAULT NULL
        `);

        return NextResponse.json({ success: true, message: 'subtotal_amount, tax_amount, tax_percentage added to invoices.' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
