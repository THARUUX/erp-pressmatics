import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute('SELECT * FROM papers ORDER BY name ASC');
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch papers' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, type, cost_per_sheet, stock_quantity } = body;

        const [result] = await pool.execute(
            'INSERT INTO papers (name, type, cost_per_sheet, stock_quantity) VALUES (?, ?, ?, ?)',
            [name, type, cost_per_sheet || 0, stock_quantity || 0]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add paper' }, { status: 500 });
    }
}
