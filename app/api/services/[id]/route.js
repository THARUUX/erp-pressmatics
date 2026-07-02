import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        const [services] = await pool.execute('SELECT * FROM services WHERE id = ?', [id]);
        if (services.length === 0) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }

        const [employees] = await pool.execute(
            'SELECT * FROM service_employees WHERE service_id = ? ORDER BY employee_name ASC',
            [id]
        );

        return NextResponse.json({
            ...services[0],
            employees: employees.map(e => ({
                ...e,
                rate: parseFloat(e.rate)
            }))
        });
    } catch (error) {
        console.error('GET /api/services/[id] error:', error);
        return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, description, employees = [] } = body;

        if (!name) {
            return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.execute(
                'UPDATE services SET name = ?, description = ? WHERE id = ?',
                [name, description || null, id]
            );

            // Sync employees: delete existing ones and re-insert
            await connection.execute('DELETE FROM service_employees WHERE service_id = ?', [id]);

            for (const emp of employees) {
                if (!emp.employee_name) continue;
                await connection.execute(
                    'INSERT INTO service_employees (service_id, employee_name, default_rate_unit, rate) VALUES (?, ?, ?, ?)',
                    [id, emp.employee_name, emp.default_rate_unit || 'per hour', parseFloat(emp.rate) || 0]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('PUT /api/services/[id] error:', error);
        return NextResponse.json({ error: 'Failed to update service', details: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;

        // Cascade delete will delete employee records due to the foreign key constraint
        await pool.execute('DELETE FROM services WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/services/[id] error:', error);
        return NextResponse.json({ error: 'Failed to delete service', details: error.message }, { status: 500 });
    }
}
