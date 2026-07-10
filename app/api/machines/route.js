import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT m.*,
                   p.name  AS plate_name,
                   p.unit_cost AS plate_cost,
                   e.name  AS assigned_employee_name,
                   e.job_title AS assigned_employee_title,
                   t.name  AS assigned_team_name,
                   t.color AS assigned_team_color
            FROM machines m
            LEFT JOIN inventory_items p ON m.plate_id = p.id
            LEFT JOIN employees       e ON m.assigned_employee_id = e.id
            LEFT JOIN teams           t ON m.assigned_team_id     = t.id
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
        const {
            name, type, sheet_factor, speed, speed_unit, plate_id,
            digital_price_max, digital_price_medium, digital_price_min,
            assigned_employee_id, assigned_team_id, make_ready_minutes, shift_limit
        } = body;

        await pool.execute(
            `INSERT INTO machines
             (name, type, sheet_factor, speed, speed_unit, plate_id,
              digital_price_max, digital_price_medium, digital_price_min,
              assigned_employee_id, assigned_team_id, make_ready_minutes, shift_limit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                type,
                sheet_factor || 1.0,
                speed || 0,
                speed_unit || 'Sheets/Hr',
                plate_id || null,
                parseFloat(digital_price_max)    || 0,
                parseFloat(digital_price_medium) || 0,
                parseFloat(digital_price_min)    || 0,
                assigned_employee_id || null,
                assigned_team_id     || null,
                parseInt(make_ready_minutes) || 0,
                shift_limit !== undefined && shift_limit !== '' ? parseInt(shift_limit) : 8
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add Machine Error:', error);
        return NextResponse.json({ error: 'Failed to add machine: ' + error.message }, { status: 500 });
    }
}
