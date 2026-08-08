import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req, { params }) {
    const { id } = await params;
    try {
        const { delivery_address } = await req.json();

        await pool.execute(
            'UPDATE deliveries SET delivery_address = ? WHERE id = ?',
            [delivery_address || null, id]
        );

        return NextResponse.json({ success: true, message: 'Delivery address updated successfully' });
    } catch (error) {
        console.error('Update Delivery Error:', error);
        return NextResponse.json({ error: 'Failed to update delivery details' }, { status: 500 });
    }
}
