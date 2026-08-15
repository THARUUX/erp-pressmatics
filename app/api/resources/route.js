import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureResourceTables } from '@/lib/resourcesDb';

export async function GET() {
    try {
        await ensureResourceTables();

        const [categories] = await pool.execute(
            'SELECT * FROM resource_categories ORDER BY parent_id ASC, name ASC'
        );

        const [links] = await pool.execute(
            'SELECT * FROM resource_links ORDER BY title ASC'
        );

        return NextResponse.json({
            categories,
            links
        });
    } catch (error) {
        console.error('Failed to fetch resources:', error);
        return NextResponse.json({ error: 'Failed to fetch resources: ' + error.message }, { status: 500 });
    }
}
