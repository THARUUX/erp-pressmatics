import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/purchase-orders/[id]/receive
 * Body: { items: [{ poi_id, received_qty }] }
 *
 * For each line item:
 *   - Updates received_qty in purchase_order_items
 *   - Increments stock_quantity in inventory_items (if linked)
 * Then recalculates PO status:
 *   - 'received' if all lines fully received
 *   - 'partial'  if some received
 *   - 'ordered'  if none received
 */
export async function POST(req, { params }) {
    const conn = await (await import('@/lib/db')).default.getConnection();
    try {
        const { id } = await params;
        const body = await req.json();
        const receivedItems = body.items || []; // [{ poi_id, received_qty }]

        await conn.beginTransaction();

        // Fetch existing line items for this PO
        const [lineItems] = await conn.execute(
            'SELECT * FROM purchase_order_items WHERE po_id = ?', [id]
        );

        for (const received of receivedItems) {
            const line = lineItems.find(l => l.id === received.poi_id);
            if (!line) continue;

            const addQty = parseFloat(received.received_qty) || 0;
            if (addQty <= 0) continue;

            const newReceived = parseFloat(line.received_qty) + addQty;

            // Update received_qty on the line
            await conn.execute(
                'UPDATE purchase_order_items SET received_qty = ? WHERE id = ?',
                [newReceived, line.id]
            );

            // Prefer the override inventory_item_id from the request, fall back to stored value
            const effectiveInvId = received.inventory_item_id || line.inventory_item_id || null;

            if (effectiveInvId) {
                await conn.execute(
                    'UPDATE inventory_items SET stock_quantity = stock_quantity + ? WHERE id = ?',
                    [addQty, effectiveInvId]
                );

                // If this was an override (line had no link), persist it on the PO line for future receipts
                if (!line.inventory_item_id && received.inventory_item_id) {
                    await conn.execute(
                        'UPDATE purchase_order_items SET inventory_item_id = ? WHERE id = ?',
                        [effectiveInvId, line.id]
                    );
                }
            }
        }

        // Recalculate PO status
        const [updatedLines] = await conn.execute(
            'SELECT quantity, received_qty FROM purchase_order_items WHERE po_id = ?', [id]
        );
        const allReceived = updatedLines.every(l => parseFloat(l.received_qty) >= parseFloat(l.quantity));
        const anyReceived = updatedLines.some(l => parseFloat(l.received_qty) > 0);
        const newStatus = allReceived ? 'received' : anyReceived ? 'partial' : 'ordered';

        await conn.execute('UPDATE purchase_orders SET status=? WHERE id=?', [newStatus, id]);

        await conn.commit();
        return NextResponse.json({ success: true, status: newStatus });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return NextResponse.json({ error: 'Failed to receive purchase order' }, { status: 500 });
    } finally {
        conn.release();
    }
}
