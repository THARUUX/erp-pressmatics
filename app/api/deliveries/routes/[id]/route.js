import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [routes] = await pool.execute(
            `SELECT * FROM delivery_routes WHERE id = ?`,
            [id]
        );

        if (routes.length === 0) {
            return NextResponse.json({ error: 'Delivery route not found' }, { status: 404 });
        }

        const route = routes[0];
        let stops = [];
        if (typeof route.stops_data === 'string') {
            try { stops = JSON.parse(route.stops_data); } catch (e) { stops = []; }
        } else if (Array.isArray(route.stops_data)) {
            stops = route.stops_data;
        }

        return NextResponse.json({ route: { ...route, stops_data: stops } });
    } catch (error) {
        console.error('Fetch route by ID error:', error);
        return NextResponse.json({ error: 'Failed to fetch delivery route details' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            route_name,
            route_date,
            driver_name,
            vehicle_no,
            status,
            depot_address,
            depot_latitude,
            depot_longitude,
            stops_data,
            total_distance_km,
            total_duration_mins
        } = body;

        // Verify existence
        const [existing] = await pool.execute(`SELECT id FROM delivery_routes WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return NextResponse.json({ error: 'Delivery route not found' }, { status: 404 });
        }

        const formattedStops = stops_data ? (typeof stops_data === 'string' ? stops_data : JSON.stringify(stops_data)) : null;

        await pool.execute(
            `UPDATE delivery_routes SET
                route_name = COALESCE(?, route_name),
                route_date = COALESCE(?, route_date),
                driver_name = COALESCE(?, driver_name),
                vehicle_no = COALESCE(?, vehicle_no),
                status = COALESCE(?, status),
                depot_address = COALESCE(?, depot_address),
                depot_latitude = COALESCE(?, depot_latitude),
                depot_longitude = COALESCE(?, depot_longitude),
                stops_data = COALESCE(?, stops_data),
                total_distance_km = COALESCE(?, total_distance_km),
                total_duration_mins = COALESCE(?, total_duration_mins),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                route_name || null,
                route_date || null,
                driver_name || null,
                vehicle_no || null,
                status || null,
                depot_address || null,
                depot_latitude || null,
                depot_longitude || null,
                formattedStops,
                total_distance_km !== undefined ? total_distance_km : null,
                total_duration_mins !== undefined ? total_duration_mins : null,
                id
            ]
        );

        return NextResponse.json({ message: 'Delivery route updated successfully' });
    } catch (error) {
        console.error('Update delivery route error:', error);
        return NextResponse.json({ error: 'Failed to update delivery route' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const [res] = await pool.execute(`DELETE FROM delivery_routes WHERE id = ?`, [id]);

        if (res.affectedRows === 0) {
            return NextResponse.json({ error: 'Delivery route not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Delivery route deleted successfully' });
    } catch (error) {
        console.error('Delete delivery route error:', error);
        return NextResponse.json({ error: 'Failed to delete delivery route' }, { status: 500 });
    }
}
