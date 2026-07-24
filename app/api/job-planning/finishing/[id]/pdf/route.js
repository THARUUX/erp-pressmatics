import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import FinishingTasksDocument from './FinishingTasksDocument';

const matchesFinishing = (taskName, finName) => {
    if (!taskName || !finName) return false;
    const tNorm = taskName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    const fNorm = finName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    return tNorm.startsWith(fNorm) || tNorm.includes(fNorm) || fNorm.includes(tNorm);
};

export async function GET(req, { params }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const weekStartStr = searchParams.get('weekStart');
    const dateParam = searchParams.get('date');
    const isDaily = !!dateParam;
    const isChecksheet = searchParams.get('checksheet') === 'true';

    try {
        // Fetch finishing
        const [finishingsList] = await pool.execute('SELECT * FROM finishings WHERE id = ?', [id]);
        if (!finishingsList.length) {
            return NextResponse.json({ error: 'Finishing operation not found' }, { status: 404 });
        }
        const finishing = finishingsList[0];

        const weekDays = [];
        let startDateStr = '';
        let endDateStr = '';

        if (isDaily) {
            const day = new Date(dateParam);
            day.setHours(0, 0, 0, 0);
            
            const y = day.getFullYear();
            const m = String(day.getMonth() + 1).padStart(2, '0');
            const d = String(day.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            weekDays.push({
                dateStr,
                label: day.toLocaleDateString('en-US', { weekday: 'long' }),
                shortLabel: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            });
            startDateStr = dateStr;
            endDateStr = dateStr;
        } else {
            // Parse week dates
            let currentWeekStart;
            if (weekStartStr) {
                currentWeekStart = new Date(weekStartStr);
            } else {
                // Find current week start
                const today = new Date();
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                currentWeekStart = new Date(today.setDate(diff));
            }
            currentWeekStart.setHours(0, 0, 0, 0);

            const mondayDate = new Date(currentWeekStart);
            const sundayDate = new Date(currentWeekStart);
            sundayDate.setDate(currentWeekStart.getDate() + 6);
            
            startDateStr = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`;
            endDateStr = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`;

            const includeDaysStr = searchParams.get('includeDays');
            const allowedIndexes = includeDaysStr 
                ? includeDaysStr.split(',').map(Number) 
                : [0, 1, 2, 3, 4, 5, 6];

            for (let i = 0; i < 7; i++) {
                if (!allowedIndexes.includes(i)) continue;

                const day = new Date(currentWeekStart);
                day.setDate(currentWeekStart.getDate() + i);
                
                const y = day.getFullYear();
                const m = String(day.getMonth() + 1).padStart(2, '0');
                const d = String(day.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;

                weekDays.push({
                    dateStr,
                    label: day.toLocaleDateString('en-US', { weekday: 'long' }),
                    shortLabel: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                });
            }
        }
        
        let weekRangeStr = '';
        if (isDaily) {
            weekRangeStr = new Date(startDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else {
            weekRangeStr = `${new Date(startDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(endDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }

        // Fetch all candidate tasks (machine_id IS NULL and ((scheduled_date BETWEEN start AND end) OR (scheduled_date IS NULL)))
        const [rows] = await pool.execute(
            `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
              FROM job_tasks jt
              JOIN sales_orders so ON jt.sales_order_id = so.id
              WHERE jt.machine_id IS NULL AND (
                  (jt.scheduled_date BETWEEN ? AND ?) OR (jt.scheduled_date IS NULL)
              )
              ORDER BY jt.scheduled_date ASC, so.delivery_date ASC, jt.display_order ASC`,
            [startDateStr, endDateStr]
        );

        // Filter tasks by matching finishing operation name
        const tasks = rows.filter(t => matchesFinishing(t.name, finishing.name));

        // Group tasks
        const unplannedTasks = [];
        const dailyTasksMap = {};
        weekDays.forEach(d => { dailyTasksMap[d.dateStr] = []; });

        tasks.forEach(t => {
            if (!t.scheduled_date) {
                unplannedTasks.push(t);
            } else {
                // normalize date to YYYY-MM-DD
                const d = new Date(t.scheduled_date);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const dStr = `${y}-${m}-${dd}`;

                if (dailyTasksMap[dStr]) {
                    dailyTasksMap[dStr].push(t);
                }
            }
        });

        // Build stats
        const weekScheduledTasks = tasks.filter(t => t.scheduled_date !== null);
        const totalTasks = weekScheduledTasks.length;
        const totalMinutes = weekScheduledTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
        const completedTasks = weekScheduledTasks.filter(t => t.status === 'done').length;
        const pendingTasks = weekScheduledTasks.filter(t => t.status !== 'done').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const stats = {
            totalTasks,
            totalMinutes,
            completedTasks,
            pendingTasks,
            completionRate
        };

        // Prepare tasksByDay array for rendering
        const tasksByDay = [];
        
        // Only include unplanned queue in weekly report
        if (!isDaily) {
            tasksByDay.push({ dayLabel: 'Unplanned Queue', dayDate: '', tasks: unplannedTasks });
        }
        
        weekDays.forEach(d => {
            tasksByDay.push({
                dayLabel: d.label,
                dayDate: d.shortLabel,
                tasks: dailyTasksMap[d.dateStr] || []
            });
        });

        const pdfBuffer = await renderToBuffer(
            React.createElement(FinishingTasksDocument, { 
                finishing, 
                weekRangeStr, 
                stats, 
                tasksByDay, 
                reportType: isChecksheet ? 'checksheet' : (isDaily ? 'daily' : 'weekly') 
            })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="finishing-schedule-${finishing.name.replace(/\s+/g, '-')}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Finishing PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
