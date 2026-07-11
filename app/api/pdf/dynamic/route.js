import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import DynamicDocument from './DynamicDocument';

export async function POST(req) {
    try {
        const body = await req.json();
        const { title, subtitle, columns, rows, currency, stats, columnWeights } = body;

        if (!Array.isArray(columns) || !Array.isArray(rows) || !title) {
            return NextResponse.json({ error: 'Title, columns, and rows are required' }, { status: 400 });
        }

        const pdfBuffer = await renderToBuffer(
            React.createElement(DynamicDocument, {
                title,
                subtitle: subtitle || 'Exported Directory List',
                columns,
                rows,
                currency: currency || 'LKR',
                stats: stats || [],
                columnWeights: columnWeights || {},
            })
        );

        const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${safeTitle}_report.pdf"`,
            },
        });
    } catch (error) {
        console.error('Dynamic PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
