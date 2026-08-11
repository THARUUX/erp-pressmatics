import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT s.id AS service_id, s.name AS service_name, s.description AS service_description, s.is_common,
                   se.id AS employee_id, se.employee_name, se.default_rate_unit, se.rate
            FROM services s
            LEFT JOIN service_employees se ON s.id = se.service_id
            ORDER BY s.name ASC, se.employee_name ASC
        `);

        const servicesMap = {};
        for (const r of rows) {
            if (!servicesMap[r.service_id]) {
                servicesMap[r.service_id] = {
                    id: r.service_id,
                    name: r.service_name,
                    description: r.service_description || '',
                    is_common: !!r.is_common,
                    employees: []
                };
            }
            if (r.employee_id) {
                servicesMap[r.service_id].employees.push({
                    id: r.employee_id,
                    employee_name: r.employee_name,
                    default_rate_unit: r.default_rate_unit,
                    rate: parseFloat(r.rate)
                });
            }
        }

        const services = Object.values(servicesMap);
        return NextResponse.json(services);
    } catch (error) {
        console.error('GET /api/services error:', error);
        return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, description, is_common, employees = [] } = body;

        if (!name) {
            return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [res] = await connection.execute(
                'INSERT INTO services (name, description, is_common) VALUES (?, ?, ?)',
                [name, description || null, is_common ? 1 : 0]
            );
            const serviceId = res.insertId;

            for (const emp of employees) {
                if (!emp.employee_name) continue;
                await connection.execute(
                    'INSERT INTO service_employees (service_id, employee_name, default_rate_unit, rate) VALUES (?, ?, ?, ?)',
                    [serviceId, emp.employee_name, emp.default_rate_unit || 'per hour', parseFloat(emp.rate) || 0]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true, id: serviceId });
        } catch (error) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('POST /api/services error:', error);
        return NextResponse.json({ error: 'Failed to create service', details: error.message }, { status: 500 });
    }
}
