import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const matchesFinishing = (taskName, finName) => {
    if (!taskName || !finName) return false;
    const tNorm = taskName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    const fNorm = finName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    return tNorm.startsWith(fNorm) || tNorm.includes(fNorm) || fNorm.includes(tNorm);
};

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type'); // 'machine' or 'finishing'
        const id = searchParams.get('id');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!type || !id) {
            // Return selection lists
            const [machines] = await pool.execute('SELECT id, name, type FROM machines ORDER BY name ASC');
            const [finishings] = await pool.execute('SELECT id, name FROM finishings WHERE machine_id IS NULL OR is_machine = 0 ORDER BY name ASC');
            return NextResponse.json({ machines, finishings });
        }

        let name = '';
        let tasks = [];

        if (type === 'machine') {
            const [mRows] = await pool.execute('SELECT name FROM machines WHERE id = ?', [id]);
            if (!mRows.length) {
                return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
            }
            name = mRows[0].name;

            let query = `SELECT jt.*, so.code AS order_code, so.customer_name,
                        CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL
                             THEN TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at)
                             ELSE NULL END AS actual_minutes
                  FROM job_tasks jt
                  LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                  WHERE jt.machine_id = ?`;
            const paramsList = [id];

            if (startDate && endDate) {
                query += ` AND (
                    (jt.scheduled_date BETWEEN ? AND ?)
                    OR (jt.scheduled_date IS NULL AND jt.created_at BETWEEN ? AND ?)
                )`;
                paramsList.push(startDate, endDate, `${startDate} 00:00:00`, `${endDate} 23:59:59`);
            }

            query += ` ORDER BY jt.scheduled_date ASC, jt.id ASC`;

            const [tRows] = await pool.execute(query, paramsList);
            tasks = tRows;
        } else if (type === 'finishing') {
            const [fRows] = await pool.execute('SELECT name FROM finishings WHERE id = ?', [id]);
            if (!fRows.length) {
                return NextResponse.json({ error: 'Finishing not found' }, { status: 404 });
            }
            const finName = fRows[0].name;
            name = finName;

            let query = `SELECT jt.*, so.code AS order_code, so.customer_name,
                        CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL
                             THEN TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at)
                             ELSE NULL END AS actual_minutes
                 FROM job_tasks jt
                 LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                 WHERE jt.machine_id IS NULL`;
            const paramsList = [];

            if (startDate && endDate) {
                query += ` AND (
                    (jt.scheduled_date BETWEEN ? AND ?)
                    OR (jt.scheduled_date IS NULL AND jt.created_at BETWEEN ? AND ?)
                )`;
                paramsList.push(startDate, endDate, `${startDate} 00:00:00`, `${endDate} 23:59:59`);
            }

            query += ` ORDER BY jt.scheduled_date ASC, jt.id ASC`;

            const [tRows] = await pool.execute(query, paramsList);
            
            // Filter by name matching
            tasks = tRows.filter(t => matchesFinishing(t.name, finName));
        } else {
            return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
        }

        // Metrics calculations
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const pendingTasks = totalTasks - completedTasks;

        const totalRunQty = tasks.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
        const unplannedRunQty = tasks.filter(t => !t.scheduled_date).reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
        const completedRunQty = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
        const uncompletedRunQty = totalRunQty - completedRunQty;

        const totalEstMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
        const totalActMinutes = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
        const unplannedDuration = tasks.filter(t => !t.scheduled_date).reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
        const uncompletedDuration = tasks.filter(t => t.status !== 'done').reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

        let finalUnplannedRunQty = unplannedRunQty;
        let finalUnplannedDuration = unplannedDuration;
        let finalUncompletedRunQty = uncompletedRunQty;
        let finalUncompletedDuration = uncompletedDuration;

        if (startDate && endDate) {
            const today = new Date();
            const colomboDateStr = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Colombo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(today);
            
            const includesToday = (colomboDateStr >= startDate && colomboDateStr <= endDate);
            if (!includesToday) {
                finalUnplannedRunQty = 0;
                finalUnplannedDuration = 0;
                finalUncompletedRunQty = 0;
                finalUncompletedDuration = 0;
            }
        }

        // Daily Production Summary Grouping
        const dailyMap = {};
        tasks.forEach(t => {
            if (!t.scheduled_date) return;
            // Normalize date to YYYY-MM-DD
            let key = '';
            try {
                const d = new Date(t.scheduled_date);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                key = `${y}-${m}-${dd}`;
            } catch (e) {
                key = String(t.scheduled_date);
            }

            if (!dailyMap[key]) {
                dailyMap[key] = {
                    date: key,
                    totalTasks: 0,
                    completedTasks: 0,
                    runQty: 0,
                    completedRunQty: 0,
                    estMinutes: 0,
                    actMinutes: 0
                };
            }

            dailyMap[key].totalTasks += 1;
            if (t.status === 'done') dailyMap[key].completedTasks += 1;
            
            const qVal = parseFloat(t.quantity) || 0;
            dailyMap[key].runQty += qVal;
            if (t.status === 'done') dailyMap[key].completedRunQty += qVal;

            dailyMap[key].estMinutes += (t.estimated_minutes || 0);
            dailyMap[key].actMinutes += (t.actual_minutes || 0);
        });

        const dailySummary = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
            type,
            id,
            name,
            stats: {
                totalTasks,
                completedTasks,
                pendingTasks,
                totalRunQty,
                unplannedRunQty: finalUnplannedRunQty,
                plannedRunQty: totalRunQty - finalUnplannedRunQty,
                completedRunQty,
                uncompletedRunQty: finalUncompletedRunQty,
                totalEstMinutes,
                totalActMinutes,
                unplannedDuration: finalUnplannedDuration,
                uncompletedDuration: finalUncompletedDuration
            },
            dailySummary,
            tasks: tasks.map(t => ({
                id: t.id,
                name: t.name,
                order_code: t.order_code,
                customer_name: t.customer_name,
                status: t.status,
                quantity: t.quantity,
                scheduled_date: t.scheduled_date,
                estimated_minutes: t.estimated_minutes,
                actual_minutes: t.actual_minutes
            }))
        });
    } catch (err) {
        console.error('API production-planning GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
