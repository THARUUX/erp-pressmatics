import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute('SELECT * FROM plates ORDER BY name ASC');
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch plates' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { name, unit_cost } = await req.json();

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const [result] = await pool.execute(
            'INSERT INTO plates (name, unit_cost) VALUES (?, ?)',
            [name, parseFloat(unit_cost) || 0]
        );

        return NextResponse.json({ id: result.insertId, name, unit_cost, success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create plate' }, { status: 500 });
    }
}
