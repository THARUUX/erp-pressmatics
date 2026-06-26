import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ONE-TIME MIGRATION: GET /api/setup/invoices-qty-price
// Adds qty and unit_price columns to the invoices table.
export async function GET() {
    try {
        await pool.execute(`
            ALTER TABLE invoices
            ADD COLUMN IF NOT EXISTS qty        DECIMAL(12,4) NULL DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,4) NULL DEFAULT NULL
        `);

        return NextResponse.json({ success: true, message: 'qty and unit_price columns added to invoices.' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
