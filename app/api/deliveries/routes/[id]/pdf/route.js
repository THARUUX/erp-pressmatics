import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import pool from '@/lib/db';
import { RouteManifestPdfDocument } from './RouteManifestPdfDocument';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.execute('SELECT * FROM delivery_routes WHERE id = ?', [id]);

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Delivery route not found' }, { status: 404 });
        }

        const route = rows[0];
        if (typeof route.stops_data === 'string') {
            try { route.stops_data = JSON.parse(route.stops_data); } catch (e) { route.stops_data = []; }
        }

        const pdfBuffer = await renderToBuffer(<RouteManifestPdfDocument route={route} />);

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Route-Manifest-${route.route_name || id}.pdf"`
            }
        });
    } catch (error) {
        console.error('Route manifest PDF error:', error);
        return NextResponse.json({ error: 'Failed to generate Route Manifest PDF' }, { status: 500 });
    }
}
