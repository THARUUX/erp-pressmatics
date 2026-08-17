import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureCategoryColumn() {
    try {
        await pool.execute("ALTER TABLE papers ADD COLUMN category VARCHAR(50) DEFAULT 'Offset'");
    } catch (e) {
        // Ignore if column already exists
    }
}

export async function GET() {
    try {
        await ensureCategoryColumn();
        const [rows] = await pool.execute('SELECT * FROM papers ORDER BY name ASC');
        return NextResponse.json(rows);
    } catch (error) {
        console.error('Fetch Papers Error:', error);
        return NextResponse.json({ error: 'Failed to fetch papers' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await ensureCategoryColumn();
        const body = await req.json();
        const { name, type, category, cost_per_sheet, stock_quantity, min_stock } = body;

        const paperCategory = category || 'Offset';

        const [result] = await pool.execute(
            'INSERT INTO papers (name, type, category, cost_per_sheet, stock_quantity, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
            [name, type || 'Art Paper', paperCategory, cost_per_sheet || 0, stock_quantity || 0, min_stock || 0]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Add Paper Error:', error);
        return NextResponse.json({ error: 'Failed to add paper' }, { status: 500 });
    }
}
