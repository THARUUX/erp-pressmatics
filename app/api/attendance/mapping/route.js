import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

// 1. Get List of all Employees and their current Biometric mappings
export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT e.id as employee_id, e.name, e.employee_id as erp_code, e.department, e.job_title,
                   GROUP_CONCAT(m.device_user_id ORDER BY m.device_user_id ASC) as device_user_id,
                   MAX(m.created_at) as mapped_at
            FROM employees e
            LEFT JOIN employee_zkteco_mapping m ON e.id = m.employee_id
            GROUP BY e.id
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

        // Delete existing mappings for the employee
        await pool.execute(
            'DELETE FROM employee_zkteco_mapping WHERE employee_id = ?',
            [employee_id]
        );

        // If device_user_id is empty, we just removed the mappings
        if (!device_user_id || String(device_user_id).trim() === '') {
            return NextResponse.json({ success: true, message: 'Mapping removed' });
        }

        const trimmedDeviceId = String(device_user_id).trim();
        const devIds = trimmedDeviceId.split(',').map(s => s.trim()).filter(Boolean);

        for (const devId of devIds) {
            // Delete mapping where device_user_id already exists to prevent duplicate key constraint
            await pool.execute(
                'DELETE FROM employee_zkteco_mapping WHERE device_user_id = ?',
                [devId]
            );

            // Insert mapping
            await pool.execute(
                'INSERT INTO employee_zkteco_mapping (device_user_id, employee_id) VALUES (?, ?)',
                [devId, employee_id]
            );
        }

        return NextResponse.json({ success: true, message: 'Mappings updated successfully' });
    } catch (err) {
        console.error('[attendance/mapping POST]', err);
        return NextResponse.json({ error: 'Failed to save mapping: ' + err.message }, { status: 500 });
    }
}
