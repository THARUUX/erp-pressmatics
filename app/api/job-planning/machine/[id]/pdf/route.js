import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import MachineTasksDocument from './MachineTasksDocument';

export async function GET(req, { params }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const weekStartStr = searchParams.get('weekStart');

    try {
        // Get machine
        let machine;
        let tasks;
        
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

        const weekDays = [];
        for (let i = 0; i < 7; i++) {
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

        const startDateStr = weekDays[0].dateStr;
        const endDateStr = weekDays[6].dateStr;
        const weekRangeStr = `${new Date(startDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(endDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        if (id === 'manual') {
            machine = { id: 'manual', name: 'Manual / Hand Operations', type: 'finishing', speed: 0, make_ready_minutes: 0, shift_limit: 8 };
            
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
            tasks = rows;
        } else {
            const [machines] = await pool.execute('SELECT * FROM machines WHERE id = ?', [id]);
            if (!machines.length) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
            machine = machines[0];

            const [rows] = await pool.execute(
                `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date,
                        (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                         FROM quotation_items qi
                         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                         WHERE qli.quotation_id = so.quotation_id) AS estimation_names
                 FROM job_tasks jt
                 JOIN sales_orders so ON jt.sales_order_id = so.id
                 WHERE jt.machine_id = ? AND (
                     (jt.scheduled_date BETWEEN ? AND ?) OR (jt.scheduled_date IS NULL)
                 )
                 ORDER BY jt.scheduled_date ASC, so.delivery_date ASC, jt.display_order ASC`,
                [id, startDateStr, endDateStr]
            );
            tasks = rows;
        }

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
        const tasksByDay = [
            { dayLabel: 'Unplanned Queue', dayDate: '', tasks: unplannedTasks }
        ];
        weekDays.forEach(d => {
            tasksByDay.push({
                dayLabel: d.label,
                dayDate: d.shortLabel,
                tasks: dailyTasksMap[d.dateStr]
            });
        });

        const pdfBuffer = await renderToBuffer(
            React.createElement(MachineTasksDocument, { machine, weekRangeStr, stats, tasksByDay })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="machine-schedule-${machine.name.replace(/\s+/g, '-')}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Machine PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
