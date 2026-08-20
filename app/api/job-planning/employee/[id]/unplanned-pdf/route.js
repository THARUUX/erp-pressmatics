import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import JobTaskRepository from '@/lib/repositories/JobTaskRepository';
import EmployeeUnplannedPdfDocument from './EmployeeUnplannedPdfDocument';

export async function GET(req, { params }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'pdf';
    const columnsParam = searchParams.get('columns');
    const selectedColumns = columnsParam
        ? columnsParam.split(',')
        : ['code', 'customer', 'name', 'delivery', 'quantity', 'time', 'status'];
    const includeStats = searchParams.get('includeStats') !== 'false';

    const options = {
        columns: selectedColumns,
        includeStats,
        groupByOrder: searchParams.get('groupByOrder') === 'true',
        notes: searchParams.get('notes') === 'true',
        dates: searchParams.get('dates') !== 'false',
    };

    try {
        const [[employee]] = await pool.execute(
            `SELECT id, employee_id, name, job_title, department, shift FROM employees WHERE id = ?`,
            [id]
        );
        if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        const tasks = await JobTaskRepository.getUnplannedTasksForEmployee(pool, employee.name);

        const totalTasks = tasks.length;
        const totalQty = tasks.reduce((s, t) => s + (parseFloat(t.quantity) || 0), 0);
        const totalHours = tasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0) / 60;
        const stats = { totalTasks, totalQty, totalHours };

        if (format === 'csv') {
            const headers = ['Job Code', 'Customer', 'Task Name', 'Delivery', 'Qty', 'Est. Time (Mins)', 'Status'];
            const rows = tasks.map(t => [
                t.order_code || 'STANDALONE',
                t.customer_name || '—',
                t.name || '—',
                t.order_delivery_date ? new Date(t.order_delivery_date).toLocaleDateString('en-US') : '—',
                parseFloat(t.quantity) || 0,
                t.estimated_minutes || 0,
                t.status || '—',
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
            const csv = [headers.join(','), ...rows].join('\n');
            return new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="employee-unplanned-${employee.name.replace(/\s+/g, '-')}.csv"`,
                },
            });
        }

        const pdfBuffer = await renderToBuffer(
            React.createElement(EmployeeUnplannedPdfDocument, { employee, stats, tasks, options })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="employee-unplanned-${employee.name.replace(/\s+/g, '-')}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Employee Unplanned PDF error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
