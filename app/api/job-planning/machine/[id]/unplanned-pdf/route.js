import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import pool from '@/lib/db';
import MachineUnplannedPdfDocument from './MachineUnplannedPdfDocument';

// Resolve run quantity based on speed unit
function resolveRunQty(speedUnit, { totalCutSheets = 0, sidesVal = 1, totalImpressions = 0, itemQty = 0, isBB = false, ups = 1, pages = 1, sheets = 1 } = {}) {
    const u = (speedUnit || 'Sheets/Hr').toLowerCase().trim();
    const sides = parseInt(sidesVal) || 1;
    const upsVal = parseInt(ups) || 1;
    const pagesVal = parseInt(pages) || 1;
    const sheetsVal = parseFloat(sheets) || 1;
    const qty = parseFloat(itemQty) || 0;

    if (u === 'prints/hr') return totalCutSheets * sides;
    if (u === 'sheets/hr') {
        if (isBB) return totalCutSheets * ((upsVal * sides) / pagesVal);
        return totalCutSheets / sheetsVal;
    }
    if (u === 'impressions/hr') return totalImpressions || (totalCutSheets * sides);
    return qty;
}

function generateCSV(tasks, columnsToExport) {
    const headers = [];
    const keys = [];

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

    if (columnsToExport.includes('notes')) {
        headers.push('Job Notes');
        keys.push(t => t.job_notes || '—');
    }
    if (columnsToExport.includes('specs')) {
        headers.push('Specs (Paper / Colors / Sides / Ups)');
        keys.push(t => {
            if (!t.componentSpecs) return '—';
            const spec = t.componentSpecs;
            return `Paper: ${spec.paper_name || '—'} | Colors: ${spec.colors_front || 0}+${spec.colors_back || 0} | Sides: ${spec.sides === 2 ? 'Double' : 'Single'} | Ups: ${spec.ups || 1}`;
        });
    }
    if (columnsToExport.includes('finishings')) {
        headers.push('Finishing Details');
        keys.push(t => {
            const list = [];
            if (t.finishingSpecs) {
                list.push(`${t.finishingSpecs.name} (Qty: ${t.finishingSpecs.quantity || '—'})`);
            }
            if (t.globalFinishings?.length > 0) {
                t.globalFinishings.forEach(gf => {
                    list.push(`${gf.name} (Qty: ${gf.quantity || '—'})`);
                });
            }
            return list.join('; ') || '—';
        });
    }

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
    
    const format = searchParams.get('format') || 'pdf';
    const excludeCompleted = searchParams.get('excludeCompleted') === 'true';
    const columnsParam = searchParams.get('columns');
    const selectedColumns = columnsParam ? columnsParam.split(',') : ['code', 'customer', 'name', 'delivery', 'quantity', 'time', 'status'];

    const includeStats = searchParams.get('includeStats') !== 'false';

    const options = {
        specs: selectedColumns.includes('specs'),
        notes: selectedColumns.includes('notes'),
        finishings: selectedColumns.includes('finishings'),
        dates: selectedColumns.includes('delivery'),
        groupByOrder: searchParams.get('groupByOrder') === 'true',
        columns: selectedColumns,
        includeStats,
    };

    try {
        // Fetch machine
        const [machines] = await pool.execute('SELECT * FROM machines WHERE id = ?', [id]);
        if (!machines.length) {
            return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
        }
        const machine = machines[0];

        // Fetch unplanned tasks for this machine
        const [rawTasks] = await pool.execute(
            `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date, so.job_notes,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.machine_id = ? AND jt.scheduled_date IS NULL
               AND (so.id IS NULL OR (so.status NOT IN ('Delivered', 'Cancelled', 'Completed', 'Ready') AND LOWER(so.status) NOT IN ('delivered', 'cancelled', 'completed', 'ready')))
               AND (jt.status IS NULL OR LOWER(jt.status) != 'done')
             ORDER BY jt.machine_position ASC, jt.display_order ASC, jt.id ASC`,
            [id]
        );

        // Filter out completed tasks if requested
        let tasks = rawTasks;
        if (excludeCompleted) {
            tasks = rawTasks.filter(t => t.status !== 'done');
        }

        if (tasks.length > 0) {
            const orderIds = Array.from(new Set(tasks.map(t => t.sales_order_id).filter(Boolean)));
            
            if (orderIds.length > 0) {
                const placeholders = orderIds.map(() => '?').join(',');

                // Fetch details (specs) if required
                let details = [];
                if (options.specs) {
                    const [detailsRows] = await pool.execute(
                        `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id
                         FROM quotation_item_details qid
                         JOIN quotation_items qi ON qid.quotation_item_id = qi.id
                         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                         JOIN sales_orders so ON so.quotation_id = qli.quotation_id
                         WHERE so.id IN (${placeholders})`,
                        orderIds
                    );
                    details = detailsRows;
                }

                // Fetch finishings if required
                let finishings = [];
                if (options.finishings) {
                    const [finishingsRows] = await pool.execute(
                        `SELECT qif.*, m.name as machine_name, m.speed, m.speed_unit, so.id AS sales_order_id
                         FROM quotation_item_finishings qif
                         LEFT JOIN machines m ON qif.machine_id = m.id
                         JOIN quotation_items qi ON qif.quotation_item_id = qi.id
                         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                         JOIN sales_orders so ON so.quotation_id = qli.quotation_id
                         WHERE so.id IN (${placeholders})`,
                        orderIds
                    );
                    finishings = finishingsRows;
                }

                // Enrich tasks with specifications
                for (const task of tasks) {
                    const isOffset = task.name.toLowerCase().includes('offset printing');
                    const isDigital = task.name.toLowerCase().includes('digital print');

                    // 1. Enrich Component specifications
                    if (options.specs && (isOffset || isDigital)) {
                        const parts = task.name.split(' — ');
                        const compName = parts[parts.length - 1]?.trim();

                        const detail = details.find(d =>
                            d.sales_order_id === task.sales_order_id &&
                            (d.component_name?.toLowerCase() === compName?.toLowerCase() ||
                                (isOffset && d.type === 'offset') ||
                                (isDigital && d.type === 'digital'))
                        );

                        if (detail) {
                            const pagesVal = parseInt(detail.pages) || 1;
                            const upsVal = parseInt(detail.ups) || 1;
                            const sidesVal = parseInt(detail.sides) || 1;
                            const totalPages = pagesVal * (detail.item_qty || 0);
                            const divisor = upsVal * sidesVal;
                            const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;
                            const wastage = parseFloat(detail.wastage_sheets) || 0;
                            const totalCutSheets = Math.ceil(cutSheets + wastage);
                            const totalImpressions = parseFloat(detail.printed_sheets) || 0;

                            task.componentSpecs = {
                                ...detail,
                                printed_sheets: totalImpressions,
                                wastage_sheets: wastage,
                                totalCutSheets
                            };

                            if (task.sheet_count == null || task.sheet_count === 0) {
                                task.sheet_count = totalCutSheets;
                            }
                            if (task.impression_count == null || task.impression_count === 0) {
                                task.impression_count = totalImpressions;
                            }
                            task.job_qty = detail.item_qty || 0;
                            if (task.quantity == null || task.quantity === 0) {
                                const speedUnit = task.custom_speed_unit || detail.machine_speed_unit || 'Sheets/Hr';
                                task.quantity = resolveRunQty(speedUnit, {
                                    totalCutSheets,
                                    sidesVal,
                                    totalImpressions,
                                    itemQty: detail.item_qty || 0
                                });
                            }
                        }
                    }

                    // 2. Enrich Finishing specifications
                    if (options.finishings) {
                        const parts = task.name.split(' — ');
                        const finName = parts[0]?.trim();

                        // Component-level finishing matching task name
                        const fSpec = finishings.find(f =>
                            f.sales_order_id === task.sales_order_id &&
                            f.name?.toLowerCase() === finName?.toLowerCase()
                        );
                        if (fSpec) {
                            task.finishingSpecs = fSpec;
                        }

                        // Global finishings (unassociated with components)
                        task.globalFinishings = finishings.filter(f =>
                            f.sales_order_id === task.sales_order_id &&
                            !f.quotation_item_detail_id
                        );
                    }
                }
            }
        }

        if (format === 'csv') {
            const csvData = generateCSV(tasks, selectedColumns);
            return new NextResponse(csvData, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="machine-unplanned-${machine.name.replace(/\s+/g, '-')}.csv"`,
                },
            });
        }

        // Build stats
        const totalTasks = tasks.length;
        const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
        const totalQty = tasks.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
        const totalHours = totalMinutes / 60;

        const stats = {
            totalTasks,
            totalQty,
            totalHours
        };

        const pdfBuffer = await renderToBuffer(
            React.createElement(MachineUnplannedPdfDocument, {
                machine,
                stats,
                tasks,
                options
            })
        );

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="machine-unplanned-${machine.name.replace(/\s+/g, '-')}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Machine Unplanned PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF', detail: error.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
