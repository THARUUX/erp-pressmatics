import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT m.*, p.name as plate_name, p.unit_cost as plate_cost 
            FROM machines m 
            LEFT JOIN inventory_items p ON m.plate_id = p.id 
            ORDER BY m.name ASC
        `);
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch machines' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, type, sheet_factor, speed, speed_unit, plate_id, digital_price_max, digital_price_medium, digital_price_min } = body;

        await pool.execute(
            'INSERT INTO machines (name, type, sheet_factor, speed, speed_unit, plate_id, digital_price_max, digital_price_medium, digital_price_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                name,
                type,
                sheet_factor || 1.0,
                speed || 0,
                speed_unit || 'Sheets/Hr',
                plate_id || null,
                parseFloat(digital_price_max) || 0,
                parseFloat(digital_price_medium) || 0,
                parseFloat(digital_price_min) || 0
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add Machine Error:', error);
        return NextResponse.json({ error: 'Failed to add machine: ' + error.message }, { status: 500 });
    }
}
