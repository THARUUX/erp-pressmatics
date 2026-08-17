import { NextResponse } from 'next/server';

// Haversine formula to compute distance in km between two lat/lng points
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const coords = searchParams.get('coords'); // format: "lng1,lat1;lng2,lat2;..."

        if (!coords) {
            return NextResponse.json({ error: 'coords parameter is required' }, { status: 400 });
        }

        const pointPairs = coords.split(';').map(p => {
            const [lng, lat] = p.split(',').map(Number);
            return { lng, lat };
        }).filter(p => !isNaN(p.lng) && !isNaN(p.lat));

        if (pointPairs.length < 2) {
            return NextResponse.json({ error: 'At least two valid coordinate pairs are required' }, { status: 400 });
        }

        // Try primary OSRM driving route API
        try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
            const res = await fetch(osrmUrl, {
                headers: {
                    'User-Agent': 'ERP-Pressmatics/1.0 RoutePlanner'
                },
                next: { revalidate: 60 }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    return NextResponse.json({
                        success: true,
                        geometry: route.geometry,
                        distanceMeters: route.distance,
                        durationSeconds: route.duration,
                        isFallback: false
                    });
                }
            }
        } catch (osrmErr) {
            console.warn('Primary OSRM server fetch failed, falling back to direct geometric path:', osrmErr.message);
        }

        // Fallback: Generate direct LineString polyline and estimated driving distance
        const lineCoords = pointPairs.map(p => [p.lng, p.lat]);
        let totalKm = 0;
        for (let i = 0; i < pointPairs.length - 1; i++) {
            totalKm += haversineDistance(
                pointPairs[i].lat, pointPairs[i].lng,
                pointPairs[i + 1].lat, pointPairs[i + 1].lng
            );
        }
        // Multiply straight-line distance by ~1.35 to approximate driving distance
        const estDrivingKm = totalKm * 1.35;
        const estDurationMins = Math.round((estDrivingKm / 30) * 60); // 30 km/h avg speed

        return NextResponse.json({
            success: true,
            geometry: {
                type: 'LineString',
                coordinates: lineCoords
            },
            distanceMeters: Math.round(estDrivingKm * 1000),
            durationSeconds: estDurationMins * 60,
            isFallback: true
        });
    } catch (error) {
        console.error('OSRM API Proxy error:', error);
        return NextResponse.json({ error: 'Failed to process routing request' }, { status: 500 });
    }
}
