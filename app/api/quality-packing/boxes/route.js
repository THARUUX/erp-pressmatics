import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            action = 'create',
            sales_order_id,
            sales_order_code,
            customer_name,
            item_name,
            box_number = 1,
            total_boxes = 1,
            quantity = 1,
            weight_kg = 0,
            package_type = 'Box',
            notes = '',
            packed_by = 'Packer',
            // Batch auto pack options:
            total_quantity,
            qty_per_box,
        } = body;

        if (!sales_order_id) {
            return NextResponse.json({ error: 'sales_order_id is required' }, { status: 400 });
        }

        if (action === 'batch_auto_pack') {
            const totalQty = parseInt(total_quantity || quantity || 0, 10);
            const perBox = parseInt(qty_per_box || 100, 10);
            if (totalQty <= 0 || perBox <= 0) {
                return NextResponse.json({ error: 'Invalid total quantity or quantity per box' }, { status: 400 });
            }

            const boxCount = Math.ceil(totalQty / perBox);

            // Optional: delete existing boxes for this order before re-batching
            await pool.execute('DELETE FROM packing_boxes WHERE sales_order_id = ?', [sales_order_id]);

            const insertedBoxes = [];
            let remaining = totalQty;

            for (let i = 1; i <= boxCount; i++) {
                const currentBoxQty = Math.min(remaining, perBox);
                remaining -= currentBoxQty;

                const [res] = await pool.execute(`
                    INSERT INTO packing_boxes (
                        sales_order_id, sales_order_code, customer_name, item_name,
                        box_number, total_boxes, quantity, weight_kg, package_type, notes, packed_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    sales_order_id,
                    sales_order_code || '',
                    customer_name || '',
                    item_name || 'Item',
                    i,
                    boxCount,
                    currentBoxQty,
                    weight_kg || 0,
                    package_type || 'Box',
                    notes || '',
                    packed_by || 'Packing Team'
                ]);

                insertedBoxes.push({
                    id: res.insertId,
                    box_number: i,
                    total_boxes: boxCount,
                    quantity: currentBoxQty,
                });
            }

            return NextResponse.json({
                success: true,
                message: `Generated ${boxCount} packing boxes`,
                boxes: insertedBoxes,
            });
        }

        // Single box create/add
        const [result] = await pool.execute(`
            INSERT INTO packing_boxes (
                sales_order_id, sales_order_code, customer_name, item_name,
                box_number, total_boxes, quantity, weight_kg, package_type, notes, packed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            sales_order_id,
            sales_order_code || '',
            customer_name || '',
            item_name || 'Item',
            box_number,
            total_boxes,
            quantity,
            weight_kg,
            package_type,
            notes,
            packed_by
        ]);

        return NextResponse.json({
            success: true,
            message: 'Packing box created',
            boxId: result.insertId,
        });

    } catch (error) {
        console.error('Save Packing Box Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to save packing box' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const sales_order_id = searchParams.get('sales_order_id');

        if (id) {
            await pool.execute('DELETE FROM packing_boxes WHERE id = ?', [id]);
            return NextResponse.json({ success: true, message: 'Box deleted' });
        }

        if (sales_order_id) {
            await pool.execute('DELETE FROM packing_boxes WHERE sales_order_id = ?', [sales_order_id]);
            return NextResponse.json({ success: true, message: 'All boxes cleared for order' });
        }

        return NextResponse.json({ error: 'Box id or sales_order_id is required' }, { status: 400 });
    } catch (error) {
        console.error('Delete Box Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete box' }, { status: 500 });
    }
}
