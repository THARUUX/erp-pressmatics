import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS quotation_item_sfg_lines (
                id                       INT AUTO_INCREMENT PRIMARY KEY,
                quotation_item_detail_id INT NOT NULL,
                inventory_item_id        INT NOT NULL,
                item_name                VARCHAR(255) NOT NULL,
                item_code                VARCHAR(100),
                quantity                 DECIMAL(12,4) NOT NULL DEFAULT 1,
                unit_price               DECIMAL(12,4) NOT NULL DEFAULT 0,
                total_price              DECIMAL(12,4) NOT NULL DEFAULT 0,
                created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (quotation_item_detail_id)
                    REFERENCES quotation_item_details(id) ON DELETE CASCADE,
                FOREIGN KEY (inventory_item_id)
                    REFERENCES inventory_items(id)
            )
        `);

        return NextResponse.json({ success: true, message: 'quotation_item_sfg_lines table created (or already exists).' });
    } catch (error) {
        console.error('Migrate SFG Error:', error);
        return NextResponse.json({ error: 'Migration failed', details: error.message }, { status: 500 });
    }
}
