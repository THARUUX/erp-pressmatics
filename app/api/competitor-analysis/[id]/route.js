import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/competitor-analysis/[id]
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const [[analysis]] = await pool.execute('SELECT * FROM competitor_analyses WHERE id = ?', [id]);
        if (!analysis) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const [competitors] = await pool.execute(
            'SELECT * FROM competitor_entries WHERE analysis_id = ? ORDER BY quoted_price ASC',
            [id]
        );

        return NextResponse.json({
            ...analysis,
            estimation_snapshot: analysis.estimation_snapshot
                ? (typeof analysis.estimation_snapshot === 'string'
                    ? JSON.parse(analysis.estimation_snapshot)
                    : analysis.estimation_snapshot)
                : null,
            competitors
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

// PUT /api/competitor-analysis/[id] — update name/description/competitors
export async function PUT(req, { params }) {
    const conn = await pool.getConnection();
    try {
        const { id } = await params;
        const { name, description, usd_rate, competitors = [] } = await req.json();
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        await conn.beginTransaction();

        await conn.execute(
            'UPDATE competitor_analyses SET name = ?, description = ?, usd_rate = ? WHERE id = ?',
            [name, description || null, usd_rate ? parseFloat(usd_rate) : null, id]
        );

        // Replace competitors
        await conn.execute('DELETE FROM competitor_entries WHERE analysis_id = ?', [id]);
        for (const c of competitors) {
            if (!c.competitor_name || !c.quoted_price) continue;
            await conn.execute(
                'INSERT INTO competitor_entries (analysis_id, competitor_name, quoted_price, notes, usd_rate) VALUES (?, ?, ?, ?, ?)',
                [id, c.competitor_name, parseFloat(c.quoted_price), c.notes || null, c.usd_rate ? parseFloat(c.usd_rate) : null]
            );
        }

        await conn.commit();
        return NextResponse.json({ success: true });
    } catch (e) {
        await conn.rollback();
        console.error(e);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    } finally {
        conn.release();
    }
}

// DELETE /api/competitor-analysis/[id]
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        await pool.execute('DELETE FROM competitor_analyses WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
