import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const matchesFinishing = (taskName, finName) => {
    if (!taskName || !finName) return false;
    const tNorm = taskName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    const fNorm = finName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    return tNorm.startsWith(fNorm) || tNorm.includes(fNorm) || fNorm.includes(tNorm);
};

async function enrichTasksWithRevenueDetails(tasks, orderIds, resType) {
    if (!tasks || !tasks.length || !orderIds || !orderIds.length) return tasks;

    const placeholders = orderIds.map(() => '?').join(',');
    
    // Fetch details
    const [details] = await pool.execute(
        `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                m.type AS machine_type
         FROM quotation_item_details qid
         JOIN quotation_items qi ON qid.quotation_item_id = qi.id
         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
         JOIN sales_orders so ON so.quotation_id = qli.quotation_id
         LEFT JOIN machines m ON qid.machine_id = m.id
         WHERE so.id IN (${placeholders})`,
        orderIds
    );

    // Fetch finishings
    let finishings = [];
    try {
        const [finRows] = await pool.execute(
            `SELECT qif.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                    m.speed_unit AS machine_speed_unit, m.type AS machine_type
             FROM quotation_item_finishings qif
             JOIN quotation_items qi ON qif.quotation_item_id = qi.id
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             JOIN sales_orders so ON so.quotation_id = qli.quotation_id
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE so.id IN (${placeholders})`,
            orderIds
        );
        finishings = finRows;
    } catch (e) {
        console.error('Error fetching finishings in enrichTasksWithRevenueDetails:', e);
    }

    for (const task of tasks) {
        task.revenue = 0;
        task.rate = 0;
        task.rate_unit = '';
        task.is_finishing = false;
        task.printed_sheets = 0;
        task.finishing_qty = 0;
        task.component_name = '';

        const taskName = task.name || '';

        if (resType === 'machine') {
            const isOffset = taskName.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
            const isDigital = taskName.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';
            
            const parts = taskName.split(' — ');
            const compName = (parts.length >= 3 ? parts[1] : '') || '';

            let bestDetail = null;
            let bestScore = -1;

            for (const d of details) {
                if (d.sales_order_id !== task.sales_order_id) continue;

                let score = 0;

                // Check component name match
                if (compName && d.component_name) {
                    const c1 = compName.toLowerCase().trim();
                    const c2 = d.component_name.toLowerCase().trim();
                    if (c1 === c2) {
                        score += 20;
                    } else if (c1.includes(c2) || c2.includes(c1)) {
                        score += 10;
                    }
                }

                // Check machine_id match
                if (task.machine_id && d.machine_id && task.machine_id === d.machine_id) {
                    score += 5;
                }

                // Check type match
                const typeMatch = (isOffset && d.type === 'offset') || (isDigital && d.type === 'digital');
                if (typeMatch) {
                    score += 1;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestDetail = d;
                }
            }

            const detail = bestScore > 0 ? bestDetail : null;
            if (detail) {
                task.revenue = parseFloat(detail.final_printing_cost) || 0;
                task.rate = parseFloat(detail.impression_cost_unit) || 0; // Impression rate per 1000
                task.rate_unit = 'per 1000 impressions';
                task.printed_sheets = parseFloat(detail.printed_sheets) || 0;
                task.component_name = detail.component_name || '';
            }
        } else {
            // finishing
            task.is_finishing = true;
            let bestFinishing = null;
            let bestScore = -1;

            const parts = taskName.split(' — ');
            const finName = parts[0]?.trim().toLowerCase();
            const compName = parts.length >= 3 ? parts[1]?.trim().toLowerCase() : '';

            for (const f of finishings) {
                if (f.sales_order_id !== task.sales_order_id) continue;
                if (!f.name) continue;

                let score = 0;
                const fNameLower = f.name.toLowerCase().trim();

                if (finName && fNameLower === finName) {
                    score += 10;
                } else if (finName && (fNameLower.includes(finName) || finName.includes(fNameLower))) {
                    score += 5;
                }

                // If component name is in the task, match it with detail component name
                if (compName && f.quotation_item_detail_id) {
                    const d = details.find(det => det.id === f.quotation_item_detail_id);
                    if (d && d.component_name) {
                        const c2 = d.component_name.toLowerCase().trim();
                        if (compName === c2) {
                            score += 20;
                        } else if (compName.includes(c2) || c2.includes(compName)) {
                            score += 10;
                        }
                    }
                }

                if (task.machine_id && f.machine_id && task.machine_id === f.machine_id) {
                    score += 2;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestFinishing = f;
                }
            }

            const finishing = bestScore > 0 ? bestFinishing : null;
            if (finishing) {
                task.revenue = parseFloat(finishing.total_cost) || 0;
                task.rate = parseFloat(finishing.unit_cost) || 0;
                task.rate_unit = finishing.cost_unit || 'Unit';
                task.finishing_qty = parseFloat(finishing.quantity) || 0;
            }
        }
    }

    return tasks;
}

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

            let query = `SELECT jt.*, so.code AS order_code, so.customer_name, m.type AS machine_type,
                        COALESCE(
                            (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                            CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0)) ELSE NULL END
                        ) AS actual_minutes
                  FROM job_tasks jt
                  LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                  LEFT JOIN machines m ON jt.machine_id = m.id
                  WHERE jt.machine_id = ?`;
            const paramsList = [id];

            if (startDate && endDate) {
                query += ` AND jt.scheduled_date BETWEEN ? AND ?`;
                paramsList.push(startDate, endDate);
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

            let query = `SELECT jt.*, so.code AS order_code, so.customer_name, m.type AS machine_type,
                        COALESCE(
                            (SELECT ROUND(SUM(COALESCE(duration_seconds, 0)) / 60) FROM job_task_work_logs WHERE task_id = jt.id HAVING COUNT(*) > 0),
                            CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at) - COALESCE(jt.downtime_minutes, 0)) ELSE NULL END
                        ) AS actual_minutes
                 FROM job_tasks jt
                 LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
                 LEFT JOIN machines m ON jt.machine_id = m.id
                 WHERE jt.machine_id IS NULL`;
            const paramsList = [];

            if (startDate && endDate) {
                query += ` AND jt.scheduled_date BETWEEN ? AND ?`;
                paramsList.push(startDate, endDate);
            }

            query += ` ORDER BY jt.scheduled_date ASC, jt.id ASC`;

            const [tRows] = await pool.execute(query, paramsList);
            
            // Filter by name matching
            tasks = tRows.filter(t => matchesFinishing(t.name, finName));
        } else {
            return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
        }

        // Enrich tasks with revenue details
        const orderIds = Array.from(new Set(tasks.map(t => t.sales_order_id).filter(Boolean)));
        if (orderIds.length > 0) {
            await enrichTasksWithRevenueDetails(tasks, orderIds, type);
        } else {
            tasks.forEach(t => {
                t.revenue = 0;
                t.rate = 0;
                t.rate_unit = '';
                t.is_finishing = false;
                t.printed_sheets = 0;
                t.finishing_qty = 0;
                t.component_name = '';
            });
        }

        // Metrics calculations
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const pendingTasks = totalTasks - completedTasks;

        const totalRunQty = tasks.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
        const unplannedRunQty = tasks.filter(t => !t.scheduled_date).reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
        const completedRunQty = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
        const uncompletedRunQty = totalRunQty - completedRunQty;

        const totalEstMinutes = tasks.reduce((sum, t) => sum + (parseFloat(t.estimated_minutes) || 0), 0);
        const totalActMinutes = tasks.reduce((sum, t) => sum + (parseFloat(t.actual_minutes) || 0), 0);
        const unplannedDuration = tasks.filter(t => !t.scheduled_date).reduce((sum, t) => sum + (parseFloat(t.estimated_minutes) || 0), 0);
        const uncompletedDuration = tasks.filter(t => t.status !== 'done').reduce((sum, t) => sum + (parseFloat(t.estimated_minutes) || 0), 0);

        // Revenue calculations
        const totalRevenue = tasks.reduce((sum, t) => sum + (parseFloat(t.revenue) || 0), 0);
        const completedRevenue = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (parseFloat(t.revenue) || 0), 0);
        const pendingRevenue = totalRevenue - completedRevenue;

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
                    actMinutes: 0,
                    revenue: 0,
                    completedRevenue: 0
                };
            }

            dailyMap[key].totalTasks += 1;
            if (t.status === 'done') dailyMap[key].completedTasks += 1;
            
            const qVal = parseFloat(t.quantity) || 0;
            dailyMap[key].runQty += qVal;
            if (t.status === 'done') dailyMap[key].completedRunQty += qVal;

            dailyMap[key].estMinutes += (parseFloat(t.estimated_minutes) || 0);
            dailyMap[key].actMinutes += (parseFloat(t.actual_minutes) || 0);
            dailyMap[key].revenue += (parseFloat(t.revenue) || 0);
            if (t.status === 'done') dailyMap[key].completedRevenue += (parseFloat(t.revenue) || 0);
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
                uncompletedDuration: finalUncompletedDuration,
                totalRevenue,
                completedRevenue,
                pendingRevenue
            },
            dailySummary,
            tasks: tasks.map(t => ({
                id: t.id,
                name: t.name,
                order_code: t.order_code,
                customer_name: t.customer_name,
                status: t.status,
                quantity: parseFloat(t.quantity) || 0,
                scheduled_date: t.scheduled_date,
                estimated_minutes: t.estimated_minutes != null ? parseFloat(t.estimated_minutes) : null,
                actual_minutes: t.actual_minutes != null ? parseFloat(t.actual_minutes) : null,
                revenue: parseFloat(t.revenue) || 0,
                rate: parseFloat(t.rate) || 0,
                rate_unit: t.rate_unit || '',
                printed_sheets: parseFloat(t.printed_sheets) || 0,
                finishing_qty: parseFloat(t.finishing_qty) || 0,
                is_finishing: t.is_finishing || false,
                component_name: t.component_name || ''
            }))
        });
    } catch (err) {
        console.error('API production-planning GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
