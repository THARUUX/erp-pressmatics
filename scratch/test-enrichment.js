const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
        }
    });

    // Find a sales order with prepress/plate tasks
    const [rows] = await pool.execute(`
        SELECT jt.sales_order_id, COUNT(*) as cnt
        FROM job_tasks jt
        JOIN machines m ON jt.machine_id = m.id
        WHERE m.type = 'prepress'
        GROUP BY jt.sales_order_id
        LIMIT 1
    `);

    if (!rows.length) {
        console.log("No sales orders with prepress tasks found.");
        await pool.end();
        return;
    }

    const orderId = rows[0].sales_order_id;
    console.log(`Using orderId: ${orderId}`);

    const [tasks] = await pool.execute(
        `SELECT jt.*, m.type AS machine_type 
         FROM job_tasks jt
         LEFT JOIN machines m ON jt.machine_id = m.id
         WHERE jt.sales_order_id = ? 
         ORDER BY jt.display_order ASC, jt.id ASC`,
        [orderId]
    );

    console.log("BEFORE ENRICHMENT prepress/plate tasks:");
    tasks.filter(t => t.name.includes("Plate") || t.machine_type === 'prepress').forEach(t => {
        console.log(`Task ID: ${t.id}, Task: ${t.name}, Qty: ${t.quantity}`);
    });

    // Let's run the enrichment logic here
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
             WHERE so.id = ?`,
            [orderId]
        );
        finishings = finRows;
    } catch (e) {
        console.error(e);
    }

    for (const task of tasks) {
        const taskName = task.name || '';
        const isOffset = taskName.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
        const isDigital = taskName.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';

        if (isOffset || isDigital) {
            // ...
        } else {
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
                    const isBB = parseInt(matchingDetail.is_bb) === 1;
                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        if (isBB && su.includes('form')) {
                            task.quantity = finishing.item_qty || 0;
                        } else {
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
                                task.quantity = totalCutSheets * sidesVal;
                            } else if (su.includes('sheet')) {
                                task.quantity = totalCutSheets;
                            }
                        }
                    }
                }
            }
        }
    }

    console.log("\nAFTER ENRICHMENT prepress/plate tasks:");
    tasks.filter(t => t.name.includes("Plate") || t.machine_type === 'prepress').forEach(t => {
        console.log(`Task ID: ${t.id}, Task: ${t.name}, Qty: ${t.quantity}`);
    });

    await pool.end();
}

run().catch(console.error);
