import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/migrations/finishing-decimal
 * Widens finishing-cost columns from DECIMAL(15,2) to DECIMAL(15,3)
 * so values like 0.125 are stored without truncation.
 * Safe to run multiple times (ALTER on already-correct column is a no-op in most cases).
 */
export async function POST() {
    const results = [];

    const alters = [
        // Per-component finishing cost rollup stored on the detail row
        {
            label: 'quotation_item_details.final_finishing_cost',
            sql: 'ALTER TABLE quotation_item_details MODIFY COLUMN final_finishing_cost DECIMAL(15, 3)',
        },
        // Finishing line items — unit and total
        {
            label: 'quotation_item_finishings.unit_cost',
            sql: 'ALTER TABLE quotation_item_finishings MODIFY COLUMN unit_cost DECIMAL(15, 3)',
        },
        {
            label: 'quotation_item_finishings.total_cost',
            sql: 'ALTER TABLE quotation_item_finishings MODIFY COLUMN total_cost DECIMAL(15, 3)',
        },
        // Master finishings catalogue
        {
            label: 'finishings.unit_cost',
            sql: 'ALTER TABLE finishings MODIFY COLUMN unit_cost DECIMAL(15, 3)',
        },
    ];

    for (const { label, sql } of alters) {
        try {
            await pool.execute(sql);
            results.push({ label, status: 'ok' });
        } catch (err) {
            results.push({ label, status: 'error', message: err.message });
        }
    }

    const allOk = results.every(r => r.status === 'ok');
    return NextResponse.json({ success: allOk, results }, { status: allOk ? 200 : 207 });
}

export const dynamic = 'force-dynamic';
