import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [machines] = await pool.execute('SELECT id, name, type FROM machines ORDER BY name ASC');
        const [finishings] = await pool.execute(
            'SELECT id, name FROM finishings WHERE machine_id IS NULL OR is_machine = 0 ORDER BY name ASC'
        );
        return NextResponse.json({ machines, finishings });
    } catch (error) {
        console.error('Operator Machines GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
