import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [machines] = await pool.execute('SELECT id, name, type FROM machines ORDER BY name ASC');
        return NextResponse.json({ machines });
    } catch (error) {
        console.error('Operator Machines GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
