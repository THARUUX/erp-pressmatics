/**
 * Shared helper to sync Sales Order items to the Delivery Queue.
 * Automatically inserts line items if the Sales Order status is 'Ready'.
 */
export async function syncSalesOrderToDeliveryQueue(salesOrderId, db) {
    try {
        console.log(`[Delivery Sync] Checking Sales Order #${salesOrderId}`);
        // Fetch Sales Order details
        const [orders] = await db.execute(
            'SELECT id, code, customer_name, status, quotation_id FROM sales_orders WHERE id = ?',
            [salesOrderId]
        );
        if (orders.length === 0) {
            console.log(`[Delivery Sync] Sales Order #${salesOrderId} not found.`);
            return;
        }

        const order = orders[0];
        if (order.status !== 'Ready') {
            console.log(`[Delivery Sync] Sales Order #${salesOrderId} is not in 'Ready' status (current: ${order.status}). Skipping sync.`);
            return;
        }

        if (!order.quotation_id) {
            console.log(`[Delivery Sync] Sales Order #${salesOrderId} has no quotation_id. Skipping sync.`);
            return;
        }

        // Fetch line items from the quotation linked to this Sales Order
        const [qItems] = await db.execute(
            `SELECT qi.id AS quotation_item_id, qi.estimation_name, qi.quantity AS total_quantity
             FROM quotation_items qi
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             WHERE qli.quotation_id = ?`,
            [order.quotation_id]
        );

        if (qItems.length === 0) {
            console.log(`[Delivery Sync] No items found for quotation ID ${order.quotation_id}.`);
            return;
        }

        console.log(`[Delivery Sync] Syncing ${qItems.length} items for Sales Order ${order.code}`);

        for (const item of qItems) {
            // Check if item is already in deliveries
            const [existing] = await db.execute(
                'SELECT id FROM deliveries WHERE sales_order_id = ? AND quotation_item_id = ?',
                [order.id, item.quotation_item_id]
            );

            if (existing.length === 0) {
                // Insert into deliveries queue
                await db.execute(
                    `INSERT INTO deliveries (
                        sales_order_id, sales_order_code, customer_name, 
                        quotation_item_id, estimation_name, total_quantity, 
                        delivered_quantity, status
                     ) VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')`,
                    [
                        order.id,
                        order.code,
                        order.customer_name || 'N/A',
                        item.quotation_item_id,
                        item.estimation_name || 'Book/Product',
                        item.total_quantity || 0
                    ]
                );
                console.log(`[Delivery Sync] Queued item: ${item.estimation_name} (Qty: ${item.total_quantity})`);
            } else {
                console.log(`[Delivery Sync] Item ${item.estimation_name} already exists in delivery queue.`);
            }
        }
    } catch (error) {
        console.error(`[Delivery Sync Error] Failed to sync Sales Order #${salesOrderId}:`, error);
        throw error;
    }
}
