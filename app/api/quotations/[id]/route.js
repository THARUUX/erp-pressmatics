import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        // Fetch Header
        const [quotes] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [id]);
        if (quotes.length === 0) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }
        const quotation = quotes[0];

        // Fetch Linked Items
        // We join quotation_line_items with quotation_items to get the full item details
        const [items] = await pool.execute(`
            SELECT qi.*, qli.display_order 
            FROM quotation_items qi
            JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
            WHERE qli.quotation_id = ?
            ORDER BY qli.display_order ASC
        `, [id]);

        // For each item, we might need its finishings too?
        // Or we can fetch them on demand / or pre-fetch if needed for detailed view?
        // For the Edit page, we usually need the basics (qty, total, description). 
        // But if we want to show a breakdown or allow deep editing, we might need more.
        // For now, let's return the items list.

        return NextResponse.json({
            ...quotation,
            items: items || []
        });
    } catch (error) {
        console.error("Fetch Quote Error:", error);
        return NextResponse.json({ error: 'Failed to fetch quotation details' }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { terms_and_conditions, show_grand_total } = body;

        // Dynamic update fields
        const updates = [];
        const values = [];

        if (terms_and_conditions !== undefined) {
            updates.push('terms_and_conditions = ?');
            values.push(terms_and_conditions);
        }

        if (show_grand_total !== undefined) {
            updates.push('show_grand_total = ?');
            values.push(show_grand_total);
        }

        if (updates.length > 0) {
            values.push(id);
            await pool.execute(`UPDATE quotations SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update Quote Error:", error);
        return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
    }
}
