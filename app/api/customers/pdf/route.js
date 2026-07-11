import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import CustomersDocument from './CustomersDocument';

export async function POST(req) {
    try {
        const body = await req.json();
        const { columns, rows, currency } = body;

        if (!Array.isArray(columns) || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Columns and rows are required' }, { status: 400 });
        }

        const pdfBuffer = await renderToBuffer(
            React.createElement(CustomersDocument, { columns, rows, currency: currency || 'LKR' })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="customers_report.pdf"',
            },
        });
    } catch (error) {
        console.error('Customer PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
