import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;

        // Start transaction (or just sequence of deletes)
        // 1. Get linked items?
        // If we want to clean up everything:
        // DELETE FROM quotation_items WHERE id IN (SELECT quotation_item_id FROM quotation_line_items WHERE quotation_id = ?)
        // DELETE FROM quotation_line_items WHERE quotation_id = ?
        // DELETE FROM quotations WHERE id = ?

        // However, let's just delete the quotation container for now to be safe, 
        // OR better cleanliness: delete everything exclusively owned.
        // Given duplication logic creates new items, they are likely owned by this quote.

        // Delete items linked to this quote
        // Note: This matches the "copy" logic which creates fresh items.
        // We first find the IDs to delete details/finishings if cascade isn't automatic.
        // Assuming DB foreign keys might handle cascade for details -> item.
        // But quotation_line_items -> quotation might not cascade delete the ITEMs.

        // Manual cleanup for safety:
        const [lines] = await pool.execute('SELECT quotation_item_id FROM quotation_line_items WHERE quotation_id = ?', [id]);
        const itemIds = lines.map(l => l.quotation_item_id);

        if (itemIds.length > 0) {
            const placeholders = itemIds.map(() => '?').join(',');

            // 1. Delete line associations FIRST (to free up items)
            await pool.execute('DELETE FROM quotation_line_items WHERE quotation_id = ?', [id]);

            // 2. Delete finishings
            await pool.execute(`DELETE FROM quotation_item_finishings WHERE quotation_item_id IN (${placeholders})`, itemIds);
            // 3. Delete details
            await pool.execute(`DELETE FROM quotation_item_details WHERE quotation_item_id IN (${placeholders})`, itemIds);
            // 4. Delete items
            await pool.execute(`DELETE FROM quotation_items WHERE id IN (${placeholders})`, itemIds);
        } else {
            // Even if no items, ensure lines are gone
            await pool.execute('DELETE FROM quotation_line_items WHERE quotation_id = ?', [id]);
        }

        // Delete quotation
        await pool.execute('DELETE FROM quotations WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete Quotation Error:", error);
        return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
    }
}
