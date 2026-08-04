import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: '+00:00',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

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

async function enrichTasksWithEstimationDetails(tasks, orderIds) {
    if (!tasks || !tasks.length || !orderIds || !orderIds.length) return tasks;

    const placeholders = orderIds.map(() => '?').join(',');
    const [details] = await pool.execute(
        `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                m.setup_minutes_per_plate, m.make_ready_minutes
         FROM quotation_item_details qid
         JOIN quotation_items qi ON qid.quotation_item_id = qi.id
         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
         JOIN sales_orders so ON so.quotation_id = qli.quotation_id
         LEFT JOIN machines m ON qid.machine_id = m.id
         WHERE so.id IN (${placeholders})`,
        orderIds
    );

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
        console.error('Error fetching finishings in enrichTasks:', e);
    }

    for (const task of tasks) {
        const isOffset = task.name.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
        const isDigital = task.name.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';

        if (isOffset || isDigital) {
            const parts = task.name.split(' — ');
            const compName = parts.length >= 3 ? parts[1]?.trim() : '';

            let bestDetail = null;
            let bestScore = -1;

            for (const d of details) {
                if (d.sales_order_id !== task.sales_order_id) continue;

                let score = 0;

                if (compName && d.component_name) {
                    const c1 = compName.toLowerCase().trim();
                    const c2 = d.component_name.toLowerCase().trim();
                    if (c1 === c2) {
                        score += 20;
                    } else if (c1.includes(c2) || c2.includes(c1)) {
                        score += 10;
                    }
                }

                if (task.machine_id && d.machine_id && task.machine_id === d.machine_id) {
                    score += 5;
                }

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
                const pagesVal = parseInt(detail.pages) || 1;
                const upsVal = parseInt(detail.ups) || 1;
                const sidesVal = parseInt(detail.sides) || 1;
                const totalPages = pagesVal * (detail.item_qty || 0);
                const divisor = upsVal * sidesVal;
                const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;
                const wastage = parseFloat(detail.wastage_sheets) || 0;
                const totalCutSheets = Math.ceil(cutSheets + wastage);

                const totalImpressions = parseFloat(detail.printed_sheets) || 0;

                if (task.sheet_count == null || task.sheet_count === 0) {
                    task.sheet_count = totalCutSheets;
                }
                if (task.impression_count == null || task.impression_count === 0) {
                    task.impression_count = totalImpressions;
                }
                const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
                const colorsVal = parseInt(detail.colors || detail.colors_front || 4);
                const colorsFront = parseInt(detail.colors_front || detail.colors || 4);
                const isBB = parseInt(detail.is_bb) === 1;
                const computedPlateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);

                task.job_qty = detail.item_qty || 0;
                task.plate_count = computedPlateCount;
                task.setup_minutes_per_plate = detail.setup_minutes_per_plate || 0;
                task.net_sheet_count = Math.ceil(cutSheets);
                task.wastage_sheets = wastage;
                task.sides = sidesVal;
                if (task.quantity == null || task.quantity === 0) {
                    const speedUnit = task.custom_speed_unit || detail.machine_speed_unit || 'Sheets/Hr';
                    const sidesVal = parseInt(detail.sides) || 1;
                    task.quantity = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: detail.item_qty || 0
                    });
                }
            }
        } else {
            let bestFinishing = null;
            let bestScore = -1;

            const parts = task.name.split(' — ');
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
                task.job_qty = finishing.item_qty || 0;

                const speedUnit = task.custom_speed_unit || finishing.machine_speed_unit || finishing.cost_unit || '';
                const su = speedUnit.toLowerCase().trim();
                const matchingDetail = details.find(d => d.id === finishing.quotation_item_detail_id);

                if (su.includes('unit')) {
                    task.job_qty = finishing.item_qty || 0;
                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        task.quantity = finishing.item_qty || 0;
                    }
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

                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        if (su.includes('print')) {
                            task.quantity = totalCutSheets * sidesVal;
                        } else if (su.includes('sheet')) {
                            task.quantity = totalCutSheets;
                        }
                    }
                }
            }
        }
    }
    return tasks;
}

async function main() {
    try {
        const [tasks] = await pool.execute(
            `SELECT jt.*, m.type AS machine_type 
             FROM job_tasks jt
             LEFT JOIN machines m ON jt.machine_id = m.id
             WHERE jt.sales_order_id IS NOT NULL`
        );
        const orderIds = Array.from(new Set(tasks.map(t => t.sales_order_id).filter(Boolean)));
        
        console.log(`Loaded ${tasks.length} tasks across ${orderIds.length} orders.`);

        const enriched = await enrichTasksWithEstimationDetails(JSON.parse(JSON.stringify(tasks)), orderIds);

        console.log('\n--- COMPARISON ---');
        let compared = 0;
        for (let i = 0; i < tasks.length; i++) {
            const original = tasks[i];
            const updated = enriched[i];

            if (original.name.toLowerCase().includes('laminating') || original.name.toLowerCase().includes('bind') || original.name.toLowerCase().includes('cut')) {
                console.log(`Task ID ${original.id} | Name: ${original.name}`);
                console.log(`  Original Qty: ${original.quantity} | Enriched Qty: ${updated.quantity} | job_qty: ${updated.job_qty}`);
                compared++;
                if (compared >= 20) break;
            }
        }

        await pool.end();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
