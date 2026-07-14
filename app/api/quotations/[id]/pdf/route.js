import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import QuotationDocument from './QuotationDocument';

export async function GET(req, { params }) {
    const { id } = await params;

    try {
        const [quotations] = await pool.execute('SELECT * FROM quotations WHERE id = ?', [id]);
        if (!quotations.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const quote = quotations[0];

        const [items] = await pool.execute(
            `SELECT qli.id as link_id, qli.display_order, qi.*
             FROM quotation_line_items qli
             JOIN quotation_items qi ON qli.quotation_item_id = qi.id
             WHERE qli.quotation_id = ?
             ORDER BY qli.display_order ASC`,
            [id]
        );
        quote.items = items;

        const [settingsRows] = await pool.execute('SELECT * FROM settings');
        const settings = {};
        settingsRows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        const pdfBuffer = await renderToBuffer(
            React.createElement(QuotationDocument, { quote, settings })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="quotation-${quote.code || id}.pdf"`,
            },
        });
    } catch (error) {
        console.error('Quotation PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
