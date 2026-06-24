import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import CompetitorAnalysisPdf from './CompetitorAnalysisPdf';

export async function GET(req, { params }) {
    const { id } = await params;
    try {
        // Fetch analysis
        const [[analysis]] = await pool.execute('SELECT * FROM competitor_analyses WHERE id = ?', [id]);
        if (!analysis) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Fetch competitors
        const [competitors] = await pool.execute(
            'SELECT * FROM competitor_entries WHERE analysis_id = ? ORDER BY quoted_price ASC',
            [id]
        );
        analysis.competitors = competitors;

        // Parse snapshot JSON
        if (analysis.estimation_snapshot && typeof analysis.estimation_snapshot === 'string') {
            analysis.estimation_snapshot = JSON.parse(analysis.estimation_snapshot);
        }

        // Pull currency symbol from settings
        const [[currencySetting]] = await pool.execute(
            "SELECT setting_value FROM settings WHERE setting_key = 'currency' LIMIT 1"
        );
        const currency = currencySetting?.setting_value || '';

        const pdfBuffer = await renderToBuffer(
            React.createElement(CompetitorAnalysisPdf, { analysis, currency })
        );

        const safeName = (analysis.name || 'analysis').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="competitor-analysis-${safeName}.pdf"`,
            },
        });
    } catch (error) {
        console.error('PDF error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
