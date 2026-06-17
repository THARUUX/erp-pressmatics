import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(req, { params }) {
    try {
        const { id, itemId } = await params;

        // Verify item belongs to quotation? (Optional but good safety)
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Remove the link between this quotation and item
            await connection.execute('DELETE FROM quotation_line_items WHERE quotation_id = ? AND quotation_item_id = ?', [id, itemId]);

            // Delete related finishings and details
            await connection.execute('DELETE FROM quotation_item_finishings WHERE quotation_item_id = ?', [itemId]);
            await connection.execute('DELETE FROM quotation_item_details WHERE quotation_item_id = ?', [itemId]);

            // Delete the item itself
            await connection.execute('DELETE FROM quotation_items WHERE id = ?', [itemId]);

            // Recalculate quotation grand total
            const [qItems] = await connection.execute(
                `SELECT qi.total_amount FROM quotation_items qi
                 JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                 WHERE qli.quotation_id = ?`,
                [id]
            );
            const newTotal = qItems.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);
            await connection.execute('UPDATE quotations SET total_amount = ? WHERE id = ?', [newTotal, id]);

            await connection.commit();
            return NextResponse.json({ success: true, newTotal });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Delete Item Error:", error);
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}
