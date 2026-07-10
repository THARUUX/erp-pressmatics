import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/teams ────────────────────────────────────────────────────────────
export async function GET() {
    try {
        const [teams] = await pool.execute(`
            SELECT t.*,
                   COUNT(DISTINCT tm.employee_id) AS member_count
            FROM teams t
            LEFT JOIN team_members tm ON tm.team_id = t.id
            GROUP BY t.id
            ORDER BY t.name ASC
        `);

        // Attach full member list to each team
        if (teams.length === 0) return NextResponse.json([]);

        const teamIds = teams.map(t => t.id);
        const placeholders = teamIds.map(() => '?').join(',');
        const [members] = await pool.execute(`
            SELECT tm.team_id, tm.role, e.id, e.name, e.job_title, e.employee_id, e.status
            FROM team_members tm
            JOIN employees e ON e.id = tm.employee_id
            WHERE tm.team_id IN (${placeholders})
            ORDER BY e.name ASC
        `, teamIds);

        const membersByTeam = {};
        for (const m of members) {
            if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = [];
            membersByTeam[m.team_id].push(m);
        }

        const result = teams.map(t => ({
            ...t,
            members: membersByTeam[t.id] || []
        }));

        return NextResponse.json(result);
    } catch (err) {
        console.error('[teams GET]', err);
        return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }
}

// ── POST /api/teams ───────────────────────────────────────────────────────────
export async function POST(req) {
    try {
        const { name, description, color = '#6366f1', member_ids = [] } = await req.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.execute(
                `INSERT INTO teams (name, description, color) VALUES (?, ?, ?)`,
                [name.trim(), description || null, color]
            );
            const teamId = result.insertId;

            for (const empId of member_ids) {
                await conn.execute(
                    `INSERT IGNORE INTO team_members (team_id, employee_id) VALUES (?, ?)`,
                    [teamId, empId]
                );
            }

            await conn.commit();
            return NextResponse.json({ success: true, id: teamId });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('[teams POST]', err);
        return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }
}
