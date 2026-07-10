import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── PUT /api/teams/[id] ───────────────────────────────────────────────────────
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const { name, description, color, member_ids = [] } = await req.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.execute(
                `UPDATE teams SET name=?, description=?, color=? WHERE id=?`,
                [name.trim(), description || null, color || '#6366f1', id]
            );

            // Replace members: delete existing, re-insert
            await conn.execute(`DELETE FROM team_members WHERE team_id = ?`, [id]);
            for (const empId of member_ids) {
                await conn.execute(
                    `INSERT IGNORE INTO team_members (team_id, employee_id) VALUES (?, ?)`,
                    [id, empId]
                );
            }

            await conn.commit();
            return NextResponse.json({ success: true });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('[teams/:id PUT]', err);
        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }
}

// ── DELETE /api/teams/[id] ────────────────────────────────────────────────────
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        // team_members cascade via FK; also clear machine assignments
        await pool.execute(`UPDATE machines SET assigned_team_id = NULL WHERE assigned_team_id = ?`, [id]);
        await pool.execute(`DELETE FROM teams WHERE id = ?`, [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[teams/:id DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
    }
}
