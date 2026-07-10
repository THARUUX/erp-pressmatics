import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// 1. Get List of all Employees and their current Biometric mappings
export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT e.id as employee_id, e.name, e.employee_id as erp_code, e.department, e.job_title,
                   m.device_user_id, m.created_at as mapped_at
            FROM employees e
            LEFT JOIN employee_zkteco_mapping m ON e.id = m.employee_id
            ORDER BY e.name ASC
        `);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[attendance/mapping GET]', err);
        return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
    }
}

// 2. Set or Update Biometric mapping
export async function POST(req) {
    try {
        const { employee_id, device_user_id } = await req.json();

        if (!employee_id) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }

        // If device_user_id is empty, delete any existing mapping for this employee
        if (!device_user_id || device_user_id.trim() === '') {
            await pool.execute(
                'DELETE FROM employee_zkteco_mapping WHERE employee_id = ?',
                [employee_id]
            );
            return NextResponse.json({ success: true, message: 'Mapping removed' });
        }

        const trimmedDeviceId = device_user_id.trim();

        // 1. Delete mapping where device_user_id already exists to prevent duplicate key constraint
        await pool.execute(
            'DELETE FROM employee_zkteco_mapping WHERE device_user_id = ?',
            [trimmedDeviceId]
        );

        // 2. Delete existing mapping for the employee (if any) to ensure 1-to-1 mapping
        await pool.execute(
            'DELETE FROM employee_zkteco_mapping WHERE employee_id = ?',
            [employee_id]
        );

        // 3. Insert new mapping
        await pool.execute(
            'INSERT INTO employee_zkteco_mapping (device_user_id, employee_id) VALUES (?, ?)',
            [trimmedDeviceId, employee_id]
        );

        return NextResponse.json({ success: true, message: 'Mapping updated successfully' });
    } catch (err) {
        console.error('[attendance/mapping POST]', err);
        return NextResponse.json({ error: 'Failed to save mapping: ' + err.message }, { status: 500 });
    }
}
