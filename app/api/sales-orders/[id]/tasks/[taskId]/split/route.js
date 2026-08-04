import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function getSalesOrderId(idOrCode) {
    if (!isNaN(idOrCode)) {
        return parseInt(idOrCode);
    }
    const [orders] = await pool.execute('SELECT id FROM sales_orders WHERE code = ?', [idOrCode]);
    return orders[0]?.id || null;
}

export async function POST(req, { params }) {
    const connection = await pool.getConnection();
    try {
        const resolvedParams = await params;
        const rawId = resolvedParams?.id;
        const { taskId } = resolvedParams;

        if (!rawId || rawId === 'undefined' || rawId === 'null') {
            return NextResponse.json({ error: 'Invalid or missing Sales Order ID' }, { status: 400 });
        }

        const salesOrderId = await getSalesOrderId(rawId);
        if (!salesOrderId) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const body = await req.json();
        const { partialQty } = body;
        const splitQty = parseFloat(partialQty);

        if (isNaN(splitQty) || splitQty <= 0) {
            return NextResponse.json({ error: 'Invalid split quantity' }, { status: 400 });
        }

        await connection.beginTransaction();

        // 1. Fetch original task
        const [tasks] = await connection.execute(
            'SELECT * FROM job_tasks WHERE id = ? AND sales_order_id = ?',
            [taskId, salesOrderId]
        );
        if (tasks.length === 0) {
            await connection.rollback();
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        const originalTask = tasks[0];

        const originalQty = parseFloat(originalTask.quantity) || 0;
        if (splitQty >= originalQty) {
            await connection.rollback();
            return NextResponse.json({ error: 'Split quantity must be less than the total task quantity' }, { status: 400 });
        }

        const remainingQty = originalQty - splitQty;

        // 2. Fetch machine specs for estimation if needed
        let speed = originalTask.custom_speed;
        let setup = originalTask.custom_make_ready_minutes;

        if (speed === null && originalTask.machine_id) {
            const [machines] = await connection.execute(
                'SELECT type, speed, make_ready_minutes, setup_minutes_per_plate FROM machines WHERE id = ?',
                [originalTask.machine_id]
            );
            if (machines.length > 0) {
                const mac = machines[0];
                speed = parseFloat(mac.speed) || 0;
                if (setup === null) {
                    const baseSetup = parseFloat(mac.make_ready_minutes) || 0;
                    const isOffset = (mac.type || '').toLowerCase() === 'offset';
                    const plateSetup = isOffset ? (parseInt(originalTask.plate_count || 0) * parseFloat(mac.setup_minutes_per_plate || 0)) : 0;
                    setup = baseSetup + plateSetup;
                }
            }
        }

        setup = setup || 0;

        let originalNewMinutes = 0;
        let splitNewMinutes = 0;

        if (speed && speed > 0) {
            originalNewMinutes = Math.ceil((remainingQty / speed) * 60) + setup;
            splitNewMinutes = Math.ceil((splitQty / speed) * 60) + setup;
        } else {
            // Proportional scaling for manual/unassigned tasks
            const originalMins = originalTask.estimated_minutes || 0;
            splitNewMinutes = Math.round((splitQty / originalQty) * originalMins);
            originalNewMinutes = Math.max(0, originalMins - splitNewMinutes);
        }

        // Scale sheet count and impression count proportionally if they exist
        const originalSheetCount = parseFloat(originalTask.sheet_count);
        const originalImpCount = parseFloat(originalTask.impression_count);

        const remainingSheetCount = isNaN(originalSheetCount) ? null : Math.round((remainingQty / originalQty) * originalSheetCount);
        const splitSheetCount = isNaN(originalSheetCount) ? null : Math.round((splitQty / originalQty) * originalSheetCount);

        const remainingImpCount = isNaN(originalImpCount) ? null : Math.round((remainingQty / originalQty) * originalImpCount);
        const splitImpCount = isNaN(originalImpCount) ? null : Math.round((splitQty / originalQty) * originalImpCount);

        const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // 3. Update original task
        await connection.execute(
            `UPDATE job_tasks 
             SET quantity = ?, estimated_minutes = ?, sheet_count = ?, impression_count = ?, is_manual = 1, updated_at = ? 
             WHERE id = ?`,
            [remainingQty, originalNewMinutes, remainingSheetCount, remainingImpCount, nowIso, taskId]
        );

        // 4. Create new split task name (append ' (Part 2)' or increment existing part number)
        let newName = originalTask.name;
        const partMatch = originalTask.name.match(/\(Part (\d+)\)/);
        if (partMatch) {
            const currentPart = parseInt(partMatch[1]);
            newName = originalTask.name.replace(`(Part ${currentPart})`, `(Part ${currentPart + 1})`);
        } else {
            newName = `${originalTask.name} (Part 2)`;
        }

        // 5. Insert split task right after the original task in machine_position or display_order
        const newMachinePosition = originalTask.machine_position !== null ? originalTask.machine_position + 1 : null;
        const newDisplayOrder = originalTask.display_order !== null ? originalTask.display_order + 1 : null;

        // Shift others to make room if needed
        if (originalTask.machine_id && newMachinePosition !== null) {
            await connection.execute(
                'UPDATE job_tasks SET machine_position = machine_position + 1 WHERE machine_id = ? AND machine_position >= ?',
                [originalTask.machine_id, newMachinePosition]
            );
        }

        await connection.execute(
            `INSERT INTO job_tasks (
                sales_order_id, name, description, status, assigned_to, display_order, 
                machine_id, machine_name, machine_position, scheduled_date, estimated_minutes, quantity, 
                sheet_count, impression_count, custom_make_ready_minutes, custom_speed, custom_speed_unit, is_manual, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [
                salesOrderId,
                newName,
                originalTask.description,
                'pending', // Split tasks start as pending
                originalTask.assigned_to,
                newDisplayOrder,
                originalTask.machine_id,
                originalTask.machine_name,
                newMachinePosition,
                originalTask.scheduled_date,
                splitNewMinutes,
                splitQty,
                splitSheetCount,
                splitImpCount,
                originalTask.custom_make_ready_minutes,
                originalTask.custom_speed,
                originalTask.custom_speed_unit,
                nowIso
            ]
        );

        await connection.commit();
        return NextResponse.json({ success: true });
    } catch (err) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }
        console.error('Split task error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        connection.release();
    }
}
