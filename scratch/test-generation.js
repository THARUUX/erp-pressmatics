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

    const orderId = 1170020;
    
    // Get sales order
    const [orders] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [orderId]);
    const order = orders[0];

    // Fetch active task configurations
    const [configs] = await pool.execute('SELECT * FROM task_configurations WHERE is_enabled = 1 ORDER BY display_order ASC');
    const [machines] = await pool.execute('SELECT id, name FROM machines');
    const machineMap = new Map(machines.map(m => [m.id, m.name]));

    // Get line items + details + finishings
    const [lineItems] = await pool.execute(
        `SELECT qi.*, qli.display_order
         FROM quotation_items qi
         JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
         WHERE qli.quotation_id = ?
         ORDER BY qli.display_order ASC`,
        [order.quotation_id]
    );

    for (const item of lineItems) {
        const [details] = await pool.execute(
            `SELECT qid.*, m.name as machine_name, m.speed as machine_speed, m.speed_unit as machine_speed_unit, 
                    m.make_ready_minutes as machine_make_ready_minutes, m.setup_minutes_per_plate as machine_setup_minutes_per_plate
             FROM quotation_item_details qid
             LEFT JOIN machines m ON qid.machine_id = m.id
             WHERE qid.quotation_item_id = ?
             ORDER BY qid.id ASC`,
            [item.id]
        );
        const [finishings] = await pool.execute(
            `SELECT qif.*, m.name as machine_name, m.speed, m.speed_unit
             FROM quotation_item_finishings qif
             LEFT JOIN machines m ON qif.machine_id = m.id
             WHERE qif.quotation_item_id = ?`,
            [item.id]
        );
        item.details = details;
        item.finishings = finishings;
    }

    const [ctpRows] = await pool.execute("SELECT id, name, speed FROM machines WHERE type = 'prepress' LIMIT 1");
    const ctpMachine = ctpRows[0] || null;

    const taskList = [];

    // 3. Plate Making Config
    const plateMakingConfig = configs.find(c => c.task_key === 'plate_making');
    if (plateMakingConfig && plateMakingConfig.is_enabled) {
        for (const item of lineItems) {
            const itemName = item.estimation_name || item.job_description || `Item ${item.id}`;
            const offsetDetails = item.details?.filter(detail => detail.type === 'offset' && (detail.component_name || itemName) !== 'Finishing' && detail.machine_name) || [];

            if (offsetDetails.length === 0) continue;

            const machineId = plateMakingConfig.machine_id || ctpMachine?.id || null;
            const machineName = plateMakingConfig.machine_id ? machineMap.get(plateMakingConfig.machine_id) : (ctpMachine?.name || null);

            console.log("offsetDetails length:", offsetDetails.length);
            console.log("is_bb_separated:", plateMakingConfig.is_bb_separated);

            if (plateMakingConfig.is_bb_separated) {
                // Separate per component
                for (const detail of offsetDetails) {
                    const compName = detail.component_name || itemName;
                    const pagesVal = parseInt(detail.pages) || 1;
                    const upsVal = parseInt(detail.ups) || 1;
                    const sidesVal = parseInt(detail.sides) || 1;
                    const colorsVal = parseInt(detail.colors || detail.colors_front || 4);
                    const colorsFront = parseInt(detail.colors_front || detail.colors || 4);
                    const isBB = parseInt(detail.is_bb) === 1;

                    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
                    const computedPlateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);
                    const plateCount = computedPlateCount;

                    const cf = parseInt(detail.colors_front ?? detail.colors ?? 4);
                    const cb = parseInt(detail.colors_back ?? 0);
                    const colorStr = cb > 0 ? `${cf}+${cb}` : `${cf}`;
                    const ctpSpeed = parseFloat(ctpMachine?.speed) || 60;
                    const plateEstMins = Math.ceil((plateCount / ctpSpeed) * 60);
                    const finalMins = plateMakingConfig.estimated_minutes !== null ? plateMakingConfig.estimated_minutes : plateEstMins;

                    console.log(`Comp: ${compName}, pages: ${pagesVal}, ups: ${upsVal}, sides: ${sidesVal}, colorsVal: ${colorsVal}, colorsFront: ${colorsFront}, isBB: ${isBB}, forms: ${forms}, computedPlateCount: ${computedPlateCount}`);

                    taskList.push({
                        name: `${plateMakingConfig.name} — ${compName} (${colorStr} colours) — ${itemName}`,
                        description: `${plateCount} plates required`,
                        machine_id: machineId,
                        machine_name: machineName,
                        display_order: plateMakingConfig.display_order,
                        estimated_minutes: finalMins,
                        quantity: plateCount,
                        sheet_count: 0,
                        impression_count: 0
                    });
                }
            } else {
                // Combine into one task for the item
                let totalPlates = 0;
                let totalMins = 0;
                let hasCalculatedMins = false;
                let colorStrings = [];

                for (const detail of offsetDetails) {
                    const pagesVal = parseInt(detail.pages) || 1;
                    const upsVal = parseInt(detail.ups) || 1;
                    const sidesVal = parseInt(detail.sides) || 1;
                    const colorsVal = parseInt(detail.colors || detail.colors_front || 4);
                    const colorsFront = parseInt(detail.colors_front || detail.colors || 4);
                    const isBB = parseInt(detail.is_bb) === 1;

                    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
                    const computedPlateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);
                    const plateCount = computedPlateCount;

                    const cf = parseInt(detail.colors_front ?? detail.colors ?? 4);
                    const cb = parseInt(detail.colors_back ?? 0);
                    const colorStr = cb > 0 ? `${cf}+${cb}` : `${cf}`;
                    colorStrings.push(`${detail.component_name || 'Component'}: ${colorStr}`);

                    totalPlates += plateCount;

                    const ctpSpeed = parseFloat(ctpMachine?.speed) || 60;
                    const plateEstMins = Math.ceil((plateCount / ctpSpeed) * 60);
                    totalMins += plateEstMins;
                    hasCalculatedMins = true;
                }

                const finalMins = plateMakingConfig.estimated_minutes !== null ? plateMakingConfig.estimated_minutes : (hasCalculatedMins ? totalMins : null);

                taskList.push({
                    name: `${plateMakingConfig.name} — ${itemName}`,
                    description: `${totalPlates} plates required (${colorStrings.join(', ')})`,
                    machine_id: machineId,
                    machine_name: machineName,
                    display_order: plateMakingConfig.display_order,
                    estimated_minutes: finalMins,
                    quantity: totalPlates,
                    sheet_count: 0,
                    impression_count: 0
                });
            }
        }
    }

    console.log("GENERATED taskList plate tasks:");
    console.log(taskList);

    await pool.end();
}

run().catch(console.error);
