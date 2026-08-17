import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req) {
    try {
        const [routes] = await pool.execute(`
            SELECT * FROM delivery_routes
            ORDER BY route_date DESC, created_at DESC
        `);

        // Parse JSON stops_data
        const parsedRoutes = routes.map(r => {
            let stops = [];
            if (typeof r.stops_data === 'string') {
                try { stops = JSON.parse(r.stops_data); } catch (e) { stops = []; }
            } else if (Array.isArray(r.stops_data)) {
                stops = r.stops_data;
            }
            return { ...r, stops_data: stops };
        });

        return NextResponse.json({ routes: parsedRoutes });
    } catch (error) {
        console.error('Fetch delivery routes error:', error);
        return NextResponse.json({ error: 'Failed to fetch delivery routes' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const {
            route_name,
            route_date,
            driver_name,
            vehicle_no,
            depot_address,
            depot_latitude,
            depot_longitude,
            stops_data,
            total_distance_km,
            total_duration_mins
        } = body;

        if (!route_name || !route_date) {
            return NextResponse.json({ error: 'Route name and route date are required' }, { status: 400 });
        }

        const [res] = await pool.execute(
            `INSERT INTO delivery_routes (
                route_name, route_date, driver_name, vehicle_no, status,
                depot_address, depot_latitude, depot_longitude,
                stops_data, total_distance_km, total_duration_mins
             ) VALUES (?, ?, ?, ?, 'Planned', ?, ?, ?, ?, ?, ?)`,
            [
                route_name,
                route_date,
                driver_name || 'Unassigned Driver',
                vehicle_no || 'Unassigned Vehicle',
                depot_address || 'Colombo Depot',
                depot_latitude || 6.9271,
                depot_longitude || 79.8612,
                JSON.stringify(stops_data || []),
                total_distance_km || 0,
                total_duration_mins || 0
            ]
        );

        return NextResponse.json({
            message: 'Delivery route saved successfully',
            route_id: res.insertId
        });
    } catch (error) {
        console.error('Save delivery route error:', error);
        return NextResponse.json({ error: 'Failed to save delivery route' }, { status: 500 });
    }
}
