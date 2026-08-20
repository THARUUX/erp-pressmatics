import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import JobTaskRepository from '@/lib/repositories/JobTaskRepository';
import MachineTasksDocument from './MachineTasksDocument';

function generateCSVForSchedule(tasks, columnsToExport) {
    const headers = ['Scheduled Date'];
    const keys = [t => t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString('en-US') : 'Unplanned'];

    const colMap = {
        code: { label: 'Job Code', getVal: t => t.order_code || 'STANDALONE' },
        customer: { label: 'Customer Name', getVal: t => t.customer_name || '—' },
        name: { label: 'Task Name', getVal: t => t.name || '—' },
        delivery: { label: 'Delivery Date', getVal: t => t.order_delivery_date ? new Date(t.order_delivery_date).toLocaleDateString('en-US') : '—' },
        quantity: { label: 'Run Qty', getVal: t => (parseFloat(t.quantity) || 0) },
        time: { label: 'Est. Time (Mins)', getVal: t => (t.estimated_minutes || 0) },
        status: { label: 'Status', getVal: t => t.status || '—' },
    };

    columnsToExport.forEach(col => {
        if (colMap[col]) {
            headers.push(colMap[col].label);
            keys.push(colMap[col].getVal);
        }
    });

    const csvRows = [headers.join(',')];

    for (const t of tasks) {
        const values = keys.map(getVal => {
            const val = String(getVal(t) || '').replace(/"/g, '""');
            return `"${val}"`;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

export async function GET(req, { params }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const weekStartStr = searchParams.get('weekStart');
    const dateParam = searchParams.get('date');
    const isDaily = !!dateParam;
    const isChecksheet = searchParams.get('checksheet') === 'true';
    
    const format = searchParams.get('format') || 'pdf';
    const excludeCompleted = searchParams.get('excludeCompleted') === 'true';
    const columnsParam = searchParams.get('columns');
    const selectedColumns = columnsParam ? columnsParam.split(',') : ['code', 'customer', 'name', 'time', 'status'];

    const includeStats = searchParams.get('includeStats') !== 'false';

    const options = {
        columns: selectedColumns,
        includeStats,
    };

    try {
        let machine;
        let rawTasks;
        
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

        if (id === 'manual' || id === 'all_finishing') {
            machine = id === 'manual'
                ? { id: 'manual', name: 'Manual / Hand Operations', type: 'finishing', speed: 0, make_ready_minutes: 0, shift_limit: 8 }
                : { id: 'all_finishing', name: 'All Finishing / Manual Tasks', type: 'finishing', speed: 0, make_ready_minutes: 0, shift_limit: 8 };

            rawTasks = await JobTaskRepository.getScheduleTasksForMachine(pool, null, startDateStr, endDateStr);
        } else {
            const [machines] = await pool.execute('SELECT * FROM machines WHERE id = ?', [id]);
            if (!machines.length) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
            machine = machines[0];

            rawTasks = await JobTaskRepository.getScheduleTasksForMachine(pool, id, startDateStr, endDateStr);
        }

        // Filter out completed tasks if requested
        let tasks = rawTasks;
        if (excludeCompleted) {
            tasks = rawTasks.filter(t => t.status !== 'done');
        }

        if (format === 'csv') {
            const csvData = generateCSVForSchedule(tasks, selectedColumns);
            return new NextResponse(csvData, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="machine-schedule-${machine.name.replace(/\s+/g, '-')}.csv"`,
                },
            });
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
            React.createElement(MachineTasksDocument, { 
                machine, 
                weekRangeStr, 
                stats, 
                tasksByDay, 
                reportType: isChecksheet ? 'checksheet' : (isDaily ? 'daily' : 'weekly'),
                options
            })
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

export const dynamic = 'force-dynamic';
