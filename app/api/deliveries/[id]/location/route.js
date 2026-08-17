import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { latitude, longitude, delivery_address } = body;

        if (latitude === undefined || longitude === undefined) {
            return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
        }

        let query = 'UPDATE deliveries SET latitude = ?, longitude = ?';
        const queryParams = [latitude, longitude];

        if (delivery_address !== undefined) {
            query += ', delivery_address = ?';
            queryParams.push(delivery_address);
        }

        query += ' WHERE id = ?';
        queryParams.push(id);

        await pool.execute(query, queryParams);

        return NextResponse.json({ message: 'Delivery location updated successfully', id, latitude, longitude });
    } catch (error) {
        console.error('Update delivery location error:', error);
        return NextResponse.json({ error: 'Failed to update delivery location' }, { status: 500 });
    }
}
