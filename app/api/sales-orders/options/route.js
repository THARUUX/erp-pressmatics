import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.execute(`
            SELECT id, code, customer_name FROM sales_orders
            ORDER BY created_at DESC LIMIT 500
        `);
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Fetch Sales Orders Options Error:", error);
        return NextResponse.json({ error: "Failed to fetch sales orders options" }, { status: 500 });
    }
}
