import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureResourceTables } from '@/lib/resourcesDb';

export async function POST(req) {
    try {
        await ensureResourceTables();
        const body = await req.json();
        const { name, parent_id, description, icon, color } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const parentIdValue = parent_id ? parseInt(parent_id, 10) : null;
        const iconValue = icon || 'folder';
        const colorValue = color || 'blue';
        const descValue = description || null;

        const [result] = await pool.execute(
            `INSERT INTO resource_categories (name, parent_id, description, icon, color) VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), parentIdValue, descValue, iconValue, colorValue]
        );

        const [newCat] = await pool.execute(
            'SELECT * FROM resource_categories WHERE id = ?',
            [result.insertId]
        );

        return NextResponse.json({ category: newCat[0] });
    } catch (error) {
        console.error('Failed to create category:', error);
        return NextResponse.json({ error: 'Failed to create category: ' + error.message }, { status: 500 });
    }
}
