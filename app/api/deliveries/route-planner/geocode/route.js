import { NextResponse } from 'next/server';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const address = searchParams.get('q');
        const limitParam = searchParams.get('limit') || '1';
        const limit = parseInt(limitParam);

        if (!address) {
            return NextResponse.json({ error: 'Address query parameter (q) is required' }, { status: 400 });
        }

        // Search via OpenStreetMap Nominatim API
        const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(address)}`;
        const res = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'ERP-Pressmatics/1.0 DeliveryPlanner'
            }
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 502 });
        }

        const results = await res.json();
        if (results && results.length > 0) {
            const formatted = results.map(loc => ({
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lon),
                display_name: loc.display_name
            }));

            if (limit > 1) {
                return NextResponse.json({ results: formatted });
            }

            const loc = formatted[0];
            return NextResponse.json({
                lat: loc.lat,
                lng: loc.lng,
                display_name: loc.display_name,
                results: formatted
            });
        }

        return NextResponse.json({ error: 'Location not found', results: [] }, { status: 444 });
    } catch (error) {
        console.error('Geocode error:', error);
        return NextResponse.json({ error: 'Failed to geocode address', results: [] }, { status: 500 });
    }
}
