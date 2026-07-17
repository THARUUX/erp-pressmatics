import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET /api/holidays ─────────────────────────────────────────────────────────
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const year = searchParams.get('year');
        
        let query = 'SELECT * FROM holidays';
        let params = [];
        
        if (year) {
            query += ' WHERE YEAR(date) = ?';
            params.push(year);
        }
        
        query += ' ORDER BY date ASC';
        const [rows] = await pool.execute(query, params);
        return NextResponse.json(rows);
    } catch (err) {
        console.error('[holidays GET]', err);
        return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 });
    }
}

// ── POST /api/holidays ────────────────────────────────────────────────────────
export async function POST(req) {
    try {
        const body = await req.json();
        const { date, name, fetchSriLankaHolidaysForYear } = body;

        // Auto-fetch national holidays
        if (fetchSriLankaHolidaysForYear) {
            const year = parseInt(fetchSriLankaHolidaysForYear, 10);
            if (isNaN(year) || year < 2000 || year > 2100) {
                return NextResponse.json({ error: 'Invalid year specified' }, { status: 400 });
            }

            console.log(`Fetching Sri Lanka public holidays for ${year}...`);
            const apiRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/LK`);
            if (!apiRes.ok) {
                throw new Error(`Public Holiday API responded with status: ${apiRes.status}`);
            }

            const holidaysList = await apiRes.json();
            let count = 0;

            for (const h of holidaysList) {
                // h.date is YYYY-MM-DD, h.localName or h.name is the name
                const hName = h.localName || h.name;
                await pool.execute(
                    `INSERT INTO holidays (date, name, is_recurring)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                    [h.date, hName, false]
                );
                count++;
            }

            return NextResponse.json({ success: true, message: `Successfully fetched and seeded ${count} holidays.` });
        }

        // Manual insert
        if (!date || !name?.trim()) {
            return NextResponse.json({ error: 'Date and name are required' }, { status: 400 });
        }

        await pool.execute(
            `INSERT INTO holidays (date, name, is_recurring)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name)`,
            [date, name.trim(), false]
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[holidays POST]', err);
        return NextResponse.json({ error: 'Failed to save holiday: ' + err.message }, { status: 500 });
    }
}

// ── DELETE /api/holidays ──────────────────────────────────────────────────────
export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing holiday ID' }, { status: 400 });
        }

        await pool.execute('DELETE FROM holidays WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[holidays DELETE]', err);
        return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 });
    }
}
