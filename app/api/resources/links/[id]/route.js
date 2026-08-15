import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureResourceTables } from '@/lib/resourcesDb';

export async function PUT(req, { params }) {
    try {
        await ensureResourceTables();
        const { id } = await params;
        const body = await req.json();
        const { title, url, description, category_id, icon, color, tags } = body;

        if (!title || !title.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        if (!url || !url.trim()) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        let formattedUrl = url.trim();
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }

        const linkId = parseInt(id, 10);
        const categoryIdValue = category_id !== undefined ? (category_id ? parseInt(category_id, 10) : null) : null;

        await pool.execute(
            `UPDATE resource_links 
             SET category_id = ?, title = ?, url = ?, description = ?, icon = ?, color = ?, tags = ? 
             WHERE id = ?`,
            [
                categoryIdValue,
                title.trim(),
                formattedUrl,
                description !== undefined ? description : null,
                icon || 'globe',
                color || 'emerald',
                tags !== undefined ? tags : null,
                linkId
            ]
        );

        const [updated] = await pool.execute(
            'SELECT * FROM resource_links WHERE id = ?',
            [linkId]
        );

        return NextResponse.json({ link: updated[0] });
    } catch (error) {
        console.error('Failed to update link:', error);
        return NextResponse.json({ error: 'Failed to update link: ' + error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        await ensureResourceTables();
        const { id } = await params;
        const linkId = parseInt(id, 10);

        await pool.execute('DELETE FROM resource_links WHERE id = ?', [linkId]);

        return NextResponse.json({ success: true, deletedId: linkId });
    } catch (error) {
        console.error('Failed to delete link:', error);
        return NextResponse.json({ error: 'Failed to delete link: ' + error.message }, { status: 500 });
    }
}
