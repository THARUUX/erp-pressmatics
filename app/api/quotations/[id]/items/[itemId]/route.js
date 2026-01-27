import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(req, { params }) {
    try {
        const { id, itemId } = await params;

        // Verify item belongs to quotation? (Optional but good safety)
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Delete related details
            await connection.execute('DELETE FROM quotation_item_details WHERE quotation_item_id = ?', [itemId]);

            // Delete related finishings
            await connection.execute('DELETE FROM quotation_item_finishings WHERE quotation_item_id = ?', [itemId]);

            // Delete the item
            await connection.execute('DELETE FROM quotation_items WHERE id = ? AND quotation_id = ?', [itemId, id]);

            await connection.commit();
            return NextResponse.json({ success: true });
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
