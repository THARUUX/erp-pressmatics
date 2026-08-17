import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    const { id } = await params;
    try {
        const { delivery_address, latitude, longitude } = await req.json();

        await pool.execute(
            'UPDATE deliveries SET delivery_address = ?, latitude = ?, longitude = ? WHERE id = ?',
            [
                delivery_address || null,
                latitude !== undefined && latitude !== null ? latitude : null,
                longitude !== undefined && longitude !== null ? longitude : null,
                id
            ]
        );

        return NextResponse.json({ success: true, message: 'Delivery address and location updated successfully' });
    } catch (error) {
        console.error('Update Delivery Error:', error);
        return NextResponse.json({ error: 'Failed to update delivery details' }, { status: 500 });
    }
}
