import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import ProductionReportDocument from './ProductionReportDocument';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        let dateStr = searchParams.get('date');

        if (!dateStr) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        }

        // Fetch all machines
        const [machines] = await pool.execute(
            'SELECT id, name, type FROM machines ORDER BY name ASC'
        );

        // Fetch tasks scheduled for this date
        const [tasks] = await pool.execute(
            `SELECT jt.*, m.name AS machine_label, m.id AS machine_id, so.code AS order_code, so.customer_name,
                    CASE WHEN jt.started_at IS NOT NULL AND jt.completed_at IS NOT NULL
                         THEN TIMESTAMPDIFF(MINUTE, jt.started_at, jt.completed_at)
                         ELSE NULL END AS actual_minutes
             FROM job_tasks jt
             JOIN machines m ON jt.machine_id = m.id
             JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE DATE(jt.scheduled_date) = ?
             ORDER BY m.name ASC, jt.machine_position ASC, jt.id ASC`,
            [dateStr]
        );

        // Group tasks by machine and filter for machines with tasks only
        const reportData = machines.map(m => ({
            ...m,
            tasks: tasks.filter(t => t.machine_id === m.id)
        })).filter(m => m.tasks.length > 0);

        // Compute summary statistics
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
        const totalActualMinutes = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);

        const stats = {
            totalTasks,
            completedTasks,
            totalEstimatedMinutes,
            totalActualMinutes
        };

        const pdfBuffer = await renderToBuffer(
            React.createElement(ProductionReportDocument, { dateStr, stats, machines: reportData })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="daily-production-report-${dateStr}.pdf"`,
            },
        });
    } catch (error) {
        console.error('Production PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}
