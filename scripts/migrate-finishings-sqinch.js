const mysql = require('mysql2/promise');
require('dotenv').config();

function resolveRunQty(speedUnit, { totalCutSheets, sidesVal, totalImpressions, itemQty }) {
    const su = (speedUnit || '').toLowerCase().trim();
    if (su.includes('print')) {
        return totalCutSheets * sidesVal;
    } else if (su.includes('sheet')) {
        return totalCutSheets;
    } else if (su.includes('impression')) {
        return totalImpressions;
    } else if (su.includes('unit')) {
        return itemQty;
    }
    return itemQty; // fallback
}

async function main() {
    console.log("Starting finishing quantity migration...");
    const pool = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { rejectUnauthorized: false }
    });

    // 1. Fetch all job tasks
    const [tasks] = await pool.execute(
        `SELECT jt.*, m.type AS machine_type 
         FROM job_tasks jt
         LEFT JOIN machines m ON jt.machine_id = m.id
         ORDER BY jt.id ASC`
    );

    console.log(`Found ${tasks.length} total tasks in database.`);

    // Group tasks by sales_order_id to optimize queries
    const tasksByOrder = {};
    for (const t of tasks) {
        if (!t.sales_order_id) continue;
        if (!tasksByOrder[t.sales_order_id]) {
            tasksByOrder[t.sales_order_id] = [];
        }
        tasksByOrder[t.sales_order_id].push(t);
    }

    let updatedCount = 0;

    for (const [orderIdStr, orderTasks] of Object.entries(tasksByOrder)) {
        const orderId = parseInt(orderIdStr);

        // Fetch details and finishings for this sales order
        const [details] = await pool.execute(
            `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                    m.setup_minutes_per_plate, m.make_ready_minutes, m.type AS machine_type
             FROM quotation_item_details qid
             JOIN quotation_items qi ON qid.quotation_item_id = qi.id
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             JOIN sales_orders so ON so.quotation_id = qli.quotation_id
             LEFT JOIN machines m ON qid.machine_id = m.id
             WHERE so.id = ?`,
            [orderId]
        );

        const [finishings] = await pool.execute(
            `SELECT qif.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                    m.speed_unit AS machine_speed_unit, m.type AS machine_type
             FROM quotation_item_finishings qif
             JOIN quotation_items qi ON qif.quotation_item_id = qi.id
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             JOIN sales_orders so ON so.quotation_id = qli.quotation_id
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE so.id = ?`,
            [orderId]
        );

        for (const task of orderTasks) {
            const taskName = task.name || '';
            const isOffset = taskName.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
            const isDigital = taskName.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';

            let targetQty = null;
            let targetSheetCount = null;
            let targetImpressionCount = null;

            if (isOffset || isDigital) {
                // Printing tasks
                const parts = taskName.split(' — ');
                const compName = (parts.length >= 3 ? parts[1] : '') || '';

                let bestDetail = null;
                let bestScore = -1;

                for (const d of details) {
                    let score = 0;
                    if (compName && d.component_name) {
                        const c1 = compName.toLowerCase().trim();
                        const c2 = d.component_name.toLowerCase().trim();
                        if (c1 === c2) score += 20;
                        else if (c1.includes(c2) || c2.includes(c1)) score += 10;
                    }
                    if (task.machine_id && d.machine_id && task.machine_id === d.machine_id) score += 5;
                    const typeMatch = (isOffset && d.type === 'offset') || (isDigital && d.type === 'digital');
                    if (typeMatch) score += 1;

                    if (score > bestScore) {
                        bestScore = score;
                        bestDetail = d;
                    }
                }

                const detail = bestScore > 0 ? bestDetail : null;
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

                    targetSheetCount = totalCutSheets;
                    targetImpressionCount = totalImpressions;

                    const speedUnit = task.custom_speed_unit || detail.machine_speed_unit || 'Sheets/Hr';
                    targetQty = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: detail.item_qty || 0
                    });
                }
            } else {
                // Finishing tasks
                let bestFinishing = null;
                let bestScore = -1;

                const parts = taskName.split(' — ');
                const finName = parts[0]?.trim().toLowerCase();
                const compName = parts.length >= 3 ? parts[1]?.trim().toLowerCase() : '';

                for (const f of finishings) {
                    if (!f.name) continue;
                    let score = 0;
                    const fNameLower = f.name.toLowerCase().trim();

                    if (finName && fNameLower === finName) score += 10;
                    else if (finName && (fNameLower.includes(finName) || finName.includes(fNameLower))) score += 5;

                    if (compName && f.quotation_item_detail_id) {
                        const d = details.find(det => det.id === f.quotation_item_detail_id);
                        if (d && d.component_name) {
                            const c2 = d.component_name.toLowerCase().trim();
                            if (compName === c2) score += 20;
                            else if (compName.includes(c2) || c2.includes(compName)) score += 10;
                        }
                    }
                    if (task.machine_id && f.machine_id && task.machine_id === f.machine_id) score += 2;

                    if (score > bestScore) {
                        bestScore = score;
                        bestFinishing = f;
                    }
                }

                const finishing = bestScore > 0 ? bestFinishing : null;
                if (finishing) {
                    const speedUnit = task.custom_speed_unit || finishing.machine_speed_unit || finishing.cost_unit || '';
                    const su = speedUnit.toLowerCase().trim();
                    const matchingDetail = details.find(d => d.id === finishing.quotation_item_detail_id);

                    if (su.includes('unit')) {
                        targetQty = finishing.item_qty || 0;
                    } else if (matchingDetail) {
                        const pagesVal = parseInt(matchingDetail.pages) || 1;
                        const upsVal = parseInt(matchingDetail.ups) || 1;
                        const sidesVal = parseInt(matchingDetail.sides) || 1;
                        const divisor = upsVal * sidesVal;
                        let netCutSheets = parseFloat(matchingDetail.printed_sheets) || 0;
                        if (divisor > 0 && finishing.item_qty > 0) {
                            netCutSheets = Math.ceil((pagesVal * finishing.item_qty) / divisor);
                        }
                        const totalCutSheets = netCutSheets + (parseFloat(matchingDetail.wastage_sheets) || 0);

                        if (su.includes('print')) {
                            targetQty = totalCutSheets * sidesVal;
                        } else if (su.includes('sheet')) {
                            targetQty = totalCutSheets;
                        }
                    }
                }
            }

            // Check if updates are needed
            if (targetQty !== null && task.is_manual !== 1) {
                const currentQty = parseFloat(task.quantity);
                const currentSheetCount = task.sheet_count;
                const currentImpressionCount = task.impression_count;

                const qtyDiff = Math.abs(currentQty - targetQty) > 0.01;
                const sheetDiff = targetSheetCount !== null && currentSheetCount !== targetSheetCount;
                const impDiff = targetImpressionCount !== null && currentImpressionCount !== targetImpressionCount;

                if (qtyDiff || sheetDiff || impDiff) {
                    console.log(`Updating Task ID ${task.id} (${task.name}):`);
                    if (qtyDiff) console.log(`  Quantity: ${currentQty} -> ${targetQty}`);
                    if (sheetDiff) console.log(`  Sheet Count: ${currentSheetCount} -> ${targetSheetCount}`);
                    if (impDiff) console.log(`  Impression Count: ${currentImpressionCount} -> ${targetImpressionCount}`);

                    await pool.execute(
                        `UPDATE job_tasks 
                         SET quantity = ?, sheet_count = COALESCE(?, sheet_count), impression_count = COALESCE(?, impression_count)
                         WHERE id = ?`,
                        [
                            targetQty,
                            targetSheetCount,
                            targetImpressionCount,
                            task.id
                        ]
                    );
                    updatedCount++;
                }
            }
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} task records.`);
    await pool.end();
}

main().catch(console.error);
