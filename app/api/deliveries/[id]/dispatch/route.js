import { NextResponse } from 'next/server';
import pool, { getWhatsAppDaemonUrl } from '@/lib/db';

export async function POST(req, { params }) {
    const conn = await pool.getConnection();
    try {
        const { id } = await params;
        const body = await req.json();
        
        const dispatched_quantity = parseInt(body.dispatched_quantity || '0');
        const books_per_parcel = parseInt(body.books_per_parcel || '50');
        const carrier_name = body.carrier_name || null;
        const tracking_number = body.tracking_number || null;
        const notes = body.notes || null;

        if (dispatched_quantity <= 0) {
            conn.release();
            return NextResponse.json({ error: 'Dispatched quantity must be greater than 0' }, { status: 400 });
        }

        await conn.beginTransaction();

        // 1. Fetch Delivery item details
        const [deliveryRows] = await conn.execute(
            'SELECT * FROM deliveries WHERE id = ?',
            [id]
        );
        if (deliveryRows.length === 0) {
            await conn.rollback();
            conn.release();
            return NextResponse.json({ error: 'Delivery item not found' }, { status: 404 });
        }

        const delivery = deliveryRows[0];
        const remaining = delivery.total_quantity - delivery.delivered_quantity;

        if (dispatched_quantity > remaining) {
            await conn.rollback();
            conn.release();
            return NextResponse.json({ 
                error: `Dispatched quantity exceeds remaining balance of ${remaining} items` 
            }, { status: 400 });
        }

        // 2. Compute parcels count
        const parcelsCount = Math.ceil(dispatched_quantity / books_per_parcel);

        // 3. Log into delivery_dispatches
        await conn.execute(
            `INSERT INTO delivery_dispatches (delivery_id, dispatched_quantity, parcels_count, carrier_name, tracking_number, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, dispatched_quantity, parcelsCount, carrier_name, tracking_number, notes]
        );

        // 4. Update delivery balance & status
        const newDeliveredQty = delivery.delivered_quantity + dispatched_quantity;
        const newDeliveryStatus = newDeliveredQty === delivery.total_quantity ? 'Delivered' : 'Partially Delivered';

        await conn.execute(
            `UPDATE deliveries 
             SET delivered_quantity = ?, books_per_parcel = ?, status = ?
             WHERE id = ?`,
            [newDeliveredQty, books_per_parcel, newDeliveryStatus, id]
        );

        // 5. Check if all delivery items for the parent Sales Order are complete
        const [allSalesOrderDeliveries] = await conn.execute(
            'SELECT total_quantity, delivered_quantity FROM deliveries WHERE sales_order_id = ?',
            [delivery.sales_order_id]
        );

        const allDelivered = allSalesOrderDeliveries.every(d => d.total_quantity === d.delivered_quantity);

        let orderDelivered = false;
        if (allDelivered) {
            // Update parent Sales Order status to 'Delivered'
            await conn.execute(
                "UPDATE sales_orders SET status = 'Delivered', updated_at = NOW() WHERE id = ?",
                [delivery.sales_order_id]
            );
            orderDelivered = true;
            console.log(`[Delivery] Sales Order #${delivery.sales_order_id} fully delivered!`);
        }

        // Fetch parent sales order details for whatsapp
        const [soRows] = await conn.execute(
            'SELECT code, customer_id, customer_name FROM sales_orders WHERE id = ?',
            [delivery.sales_order_id]
        );
        const parentOrder = soRows[0];

        await conn.commit();
        conn.release();

        // 6. Send WhatsApp notification in background if parent SO is now Delivered
        if (orderDelivered && parentOrder) {
            triggerWhatsAppDispatch(parentOrder, req.headers.get('origin')).catch(err => {
                console.error('Failed to trigger WhatsApp dispatch in background:', err);
            });
        }

        return NextResponse.json({ 
            success: true, 
            delivered_quantity: newDeliveredQty, 
            status: newDeliveryStatus,
            order_delivered: orderDelivered
        });
    } catch (error) {
        await conn.rollback();
        conn.release();
        console.error('Log Dispatch Shipment Error:', error);
        return NextResponse.json({ error: 'Failed to log dispatch shipment', details: error.message }, { status: 500 });
    }
}

// Background WhatsApp notification runner
async function triggerWhatsAppDispatch(order, originHost) {
    try {
        let phone = null;
        let token = null;

        if (order.customer_id) {
            const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE id = ?', [order.customer_id]);
            if (custRows.length > 0) {
                phone = custRows[0].phone || custRows[0].contact_phone;
                token = custRows[0].portal_token;
            }
        }
        if (!phone && order.customer_name) {
            const [custRows] = await pool.execute('SELECT phone, contact_phone, portal_token FROM customers WHERE name = ?', [order.customer_name]);
            if (custRows.length > 0) {
                phone = custRows[0].phone || custRows[0].contact_phone;
                token = custRows[0].portal_token;
            }
        }

        const [waSettingsRows] = await pool.execute(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('whatsapp_enabled', 'whatsapp_auto_send_dispatch', 'whatsapp_template_dispatch')"
        );
        const waSettings = waSettingsRows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

        if (phone && waSettings['whatsapp_enabled'] === 'true' && waSettings['whatsapp_auto_send_dispatch'] === 'true') {
            const origin = originHost || 'http://localhost:3000';
            const portalLink = token ? `${origin}/portal/${token}` : '';
            const templateText = waSettings['whatsapp_template_dispatch'] || 'Hello {customer_name}, your order {order_code} is now ready/delivered. View status: {portal_link}';
            
            const message = templateText
                .replace(/{customer_name}/g, order.customer_name || '')
                .replace(/{order_code}/g, order.code || '')
                .replace(/{portal_link}/g, portalLink || '')
                .replace(/{order_status}/g, 'Delivered')
                .replace(/{delivery_date}/g, new Date().toLocaleDateString());

            const daemonUrl = await getWhatsAppDaemonUrl();
            await fetch(`${daemonUrl}/api/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: phone, message })
            });
            console.log(`[WhatsApp Dispatch Notification] Sent successfully to ${phone} for SO ${order.code}`);
        }
    } catch (err) {
        console.error('Failed to trigger WhatsApp dispatch notification:', err);
    }
}
