import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureResourceTables } from '@/lib/resourcesDb';

export async function POST(req) {
    try {
        await ensureResourceTables();
        const body = await req.json();
        const { title, url, description, category_id, icon, color, tags } = body;

        if (!title || !title.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        if (!url || !url.trim()) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Format URL if missing protocol
        let formattedUrl = url.trim();
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }

        const categoryIdValue = category_id ? parseInt(category_id, 10) : null;
        const iconValue = icon || 'globe';
        const colorValue = color || 'emerald';
        const descValue = description || null;
        const tagsValue = tags || null;

        const [result] = await pool.execute(
            `INSERT INTO resource_links (category_id, title, url, description, icon, color, tags) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [categoryIdValue, title.trim(), formattedUrl, descValue, iconValue, colorValue, tagsValue]
        );

        const [newLink] = await pool.execute(
            'SELECT * FROM resource_links WHERE id = ?',
            [result.insertId]
        );

        return NextResponse.json({ link: newLink[0] });
    } catch (error) {
        console.error('Failed to create link:', error);
        return NextResponse.json({ error: 'Failed to create link: ' + error.message }, { status: 500 });
    }
}
