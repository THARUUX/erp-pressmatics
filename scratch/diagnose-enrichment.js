require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    try {
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

        const [orders] = await pool.execute("SELECT id FROM sales_orders WHERE code = 'SO-0143'");
        const orderId = orders[0].id;
        const [tasks] = await pool.execute("SELECT jt.*, m.type AS machine_type FROM job_tasks jt LEFT JOIN machines m ON jt.machine_id = m.id WHERE jt.sales_order_id = ? AND jt.name LIKE '%SM102%'", [orderId]);
        
        const [details] = await pool.execute(
            `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                    m.setup_minutes_per_plate, m.make_ready_minutes, m.type AS machine_type
             FROM quotation_item_details qid
             JOIN quotation_items qi ON qid.quotation_item_id = qi.id
             JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
             JOIN sales_orders so ON so.quotation_id = qli.quotation_id
             LEFT JOIN machines m ON qid.machine_id = m.id
             WHERE so.id IN (?)`,
            [orderId]
        );

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
                    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
                    const colorsVal = parseInt(detail.colors || detail.colors_front || 4);
                    const colorsFront = parseInt(detail.colors_front || detail.colors || 4);
                    const isBB = parseInt(detail.is_bb) === 1;
                    const computedPlateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);

                    console.log(`Matched detail for "${task.name}":`, {
                        component_name: detail.component_name,
                        pagesVal,
                        upsVal,
                        sidesVal,
                        forms,
                        colorsVal,
                        colorsFront,
                        isBB,
                        is_bb_db: detail.is_bb,
                        colors_back: detail.colors_back,
                        computedPlateCount
                    });
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
