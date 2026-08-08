import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// DELETE /api/services/[id]/quotations/[qId]
export async function DELETE(req, { params }) {
    try {
        const { id, qId } = await params;

        // Validate the quotation belongs to this service
        const [quotes] = await pool.execute(
            'SELECT id FROM quotations WHERE id = ? AND service_id = ?',
            [qId, id]
        );
        if (quotes.length === 0) {
            return NextResponse.json({ error: 'Quotation not found for this service' }, { status: 404 });
        }

        // Delete line items associations
        await pool.execute('DELETE FROM quotation_line_items WHERE quotation_id = ?', [qId]);

        // Delete related invoice links (set quotation_id to null to preserve invoices)
        await pool.execute('UPDATE invoices SET quotation_id = NULL WHERE quotation_id = ?', [qId]);

        // Delete quotation items that were solely for this service quotation
        const [linkedItems] = await pool.execute(
            `SELECT DISTINCT qi.id FROM quotation_items qi
             WHERE qi.type = 'services'
             AND NOT EXISTS (
                 SELECT 1 FROM quotation_line_items qli WHERE qli.quotation_item_id = qi.id
             )`,
            []
        );
        if (linkedItems.length > 0) {
            const orphanIds = linkedItems.map(r => r.id);
            await pool.execute(
                `DELETE FROM quotation_items WHERE id IN (${orphanIds.map(() => '?').join(',')})`,
                orphanIds
            );
        }

        // Delete the quotation
        await pool.execute('DELETE FROM quotations WHERE id = ?', [qId]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/services/[id]/quotations/[qId] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH /api/services/[id]/quotations/[qId]  — update status or individual fields
export async function PATCH(req, { params }) {
    try {
        const { id, qId } = await params;
        const { status, terms_and_conditions, show_grand_total, show_signature } = await req.json();

        const [quotes] = await pool.execute(
            'SELECT id FROM quotations WHERE id = ? AND service_id = ?',
            [qId, id]
        );
        if (quotes.length === 0) {
            return NextResponse.json({ error: 'Quotation not found for this service' }, { status: 404 });
        }

        const updates = [];
        const values = [];

        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }
        if (terms_and_conditions !== undefined) {
            updates.push('terms_and_conditions = ?');
            values.push(terms_and_conditions);
        }
        if (show_grand_total !== undefined) {
            updates.push('show_grand_total = ?');
            values.push(show_grand_total ? 1 : 0);
        }
        if (show_signature !== undefined) {
            updates.push('show_signature = ?');
            values.push(show_signature ? 1 : 0);
        }

        if (updates.length > 0) {
            values.push(qId);
            await pool.execute(`UPDATE quotations SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/services/[id]/quotations/[qId] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/services/[id]/quotations/[qId] — full quotation update
export async function PUT(req, { params }) {
    try {
        const { id, qId } = await params;
        const body = await req.json();

        const {
            customer_name,
            customer_phone,
            customer_email,
            customer_address,
            tax_mode = 'none',
            tax_percentage = 0,
            terms_and_conditions,
            status,
            show_grand_total,
            show_signature,
            items = []
        } = body;

        // Check if quotation exists
        const [quotes] = await pool.execute(
            'SELECT * FROM quotations WHERE id = ? AND service_id = ?',
            [qId, id]
        );
        if (quotes.length === 0) {
            return NextResponse.json({ error: 'Quotation not found for this service' }, { status: 404 });
        }
        const existingQuote = quotes[0];

        if (!customer_name || items.length === 0) {
            return NextResponse.json({ error: 'Customer name and at least one item are required' }, { status: 400 });
        }

        const finalCustomerName = customer_name.trim();

        // Update customer details if linked
        if (existingQuote.customer_id) {
            await pool.execute(
                'UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
                [finalCustomerName, customer_email || null, customer_phone || null, customer_address || null, existingQuote.customer_id]
            );
        }

        // Calculate items & totals
        let totalAmount = 0;
        const computedItems = [];
        const taxPercent = parseFloat(tax_percentage || 0);

        for (const item of items) {
            const qty = parseFloat(item.quantity || 1);
            const price = parseFloat(item.unit_price || item.price || 0);
            const itemTotal = qty * price;

            let subtotalAmount = itemTotal;
            let taxAmount = 0;
            let finalItemTotal = itemTotal;

            if (tax_mode === 'add') {
                taxAmount = itemTotal * (taxPercent / 100);
                subtotalAmount = itemTotal;
                finalItemTotal = itemTotal + taxAmount;
            } else if (tax_mode === 'deduct') {
                subtotalAmount = itemTotal / (1 + taxPercent / 100);
                taxAmount = itemTotal - subtotalAmount;
                finalItemTotal = itemTotal;
            }

            totalAmount += finalItemTotal;
            computedItems.push({
                item_name: item.item_name || item.estimation_name,
                description: item.description || item.job_description || '',
                quantity: qty,
                unit_price: price,
                subtotalAmount,
                taxAmount,
                finalItemTotal
            });
        }

        const jobDescription = computedItems.map(item => item.item_name).join(', ');
        const showGrandTotalVal = show_grand_total !== undefined ? (show_grand_total ? 1 : 0) : existingQuote.show_grand_total;
        const showSignatureVal = show_signature !== undefined ? (show_signature ? 1 : 0) : existingQuote.show_signature;

        // Update Quotation Header
        await pool.execute(
            `UPDATE quotations 
             SET customer_name = ?, 
                 total_amount = ?, 
                 job_description = ?, 
                 terms_and_conditions = ?, 
                 status = COALESCE(?, status),
                 show_grand_total = ?,
                 show_signature = ?
             WHERE id = ? AND service_id = ?`,
            [
                finalCustomerName,
                totalAmount,
                jobDescription,
                terms_and_conditions || null,
                status || null,
                showGrandTotalVal,
                showSignatureVal,
                qId,
                id
            ]
        );

        // Delete old line item associations and orphan items for this quote
        const [oldLineItems] = await pool.execute(
            'SELECT quotation_item_id FROM quotation_line_items WHERE quotation_id = ?',
            [qId]
        );
        const oldItemIds = oldLineItems.map(r => r.quotation_item_id);

        await pool.execute('DELETE FROM quotation_line_items WHERE quotation_id = ?', [qId]);

        if (oldItemIds.length > 0) {
            await pool.execute(
                `DELETE FROM quotation_items WHERE id IN (${oldItemIds.map(() => '?').join(',')}) AND type = 'services'`,
                oldItemIds
            );
        }

        // Re-insert new items
        let displayOrder = 1;
        for (const item of computedItems) {
            const itemDesc = item.description || item.item_name;
            const [itemResult] = await pool.execute(
                `INSERT INTO quotation_items (code, estimation_name, customer_name, item_name, job_description, type, quantity, total_amount, subtotal_amount, status, customer_id, tax_mode, tax_percentage, tax_amount)
                 VALUES (?, ?, ?, ?, ?, 'services', ?, ?, ?, 'linked', ?, ?, ?, ?)`,
                [
                    existingQuote.code,
                    item.item_name,
                    finalCustomerName,
                    item.item_name,
                    itemDesc,
                    item.quantity,
                    item.finalItemTotal,
                    item.subtotalAmount,
                    existingQuote.customer_id || null,
                    tax_mode,
                    taxPercent,
                    item.taxAmount
                ]
            );

            await pool.execute(
                `INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order)
                 VALUES (?, ?, ?)`,
                [qId, itemResult.insertId, displayOrder++]
            );
        }

        return NextResponse.json({ success: true, quotationId: qId });
    } catch (error) {
        console.error('PUT /api/services/[id]/quotations/[qId] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET /api/services/[id]/quotations/[qId]  — get single quotation for portal view
export async function GET(req, { params }) {
    try {
        const { id, qId } = await params;

        const [quotes] = await pool.execute(`
            SELECT q.*,
                c.email   AS customer_email,
                c.phone   AS customer_phone,
                c.address AS customer_address
            FROM quotations q
            LEFT JOIN customers c ON q.customer_id = c.id
            WHERE q.id = ? AND q.service_id = ?
        `, [qId, id]);

        if (quotes.length === 0) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }

        const [items] = await pool.execute(`
            SELECT qi.*, qli.display_order
            FROM quotation_items qi
            JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
            WHERE qli.quotation_id = ?
            ORDER BY qli.display_order ASC
        `, [qId]);

        return NextResponse.json({ ...quotes[0], items: items || [] });
    } catch (error) {
        console.error('GET /api/services/[id]/quotations/[qId] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
