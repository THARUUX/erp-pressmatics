import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Resolve the "run quantity" used in time estimation for a given speed unit.
 *  Prints/Hr       → totalCutSheets × sides  (total impressions per sheet face)
 *  Impressions/Hr  → totalImpressions  (pre-computed printed_sheets)
 *  Sheets/Hr       → totalCutSheets
 *  (fallback)      → item qty
 */
function resolveRunQty(speedUnit, { totalCutSheets = 0, sidesVal = 1, totalImpressions = 0, itemQty = 0, isBB = false, ups = 1, pages = 1, sheets = 1 } = {}) {
    const u = String(speedUnit || 'Sheets/Hr').toLowerCase().trim();
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

function getComponentTotalCutSheets(detail, qty) {
    const pagesVal = parseInt(detail.pages) || 1;
    const upsVal = parseInt(detail.ups) || 1;
    const sidesVal = parseInt(detail.sides) || 1;
    const totalPages = pagesVal * qty;
    const divisor = upsVal * sidesVal;
    const cutSheets = divisor > 0 ? (totalPages / divisor) : 0;
    const wastage = parseFloat(detail.wastage_sheets) || 0;
    return Math.ceil(cutSheets + wastage);
}

// ─── Generate tasks from actual job components (machine-aware) ───────────────
async function generateJobTasks(id) {
    // Get sales order
    const [orders] = await pool.execute('SELECT * FROM sales_orders WHERE id = ?', [id]);
    if (!orders.length) return [];
    const order = orders[0];

    // Clear existing tasks to prevent duplication
    await pool.execute('DELETE FROM job_tasks WHERE sales_order_id = ?', [id]);

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
        const [services] = await pool.execute(
            `SELECT * FROM quotation_item_services WHERE quotation_item_id = ? ORDER BY id ASC`,
            [item.id]
        );
        item.details = details;
        item.finishings = finishings;
        item.services = services;
    }

    // Fetch CTP (prepress) machine for plate making tasks
    const [ctpRows] = await pool.execute("SELECT id, name, speed FROM machines WHERE type = 'prepress' LIMIT 1");
    const ctpMachine = ctpRows[0] || null;

    const taskList = [];

    // 1. Pre-press / File Check Config
    const prepressConfig = configs.find(c => c.task_key === 'prepress');
    if (prepressConfig && prepressConfig.is_enabled) {
        const machineId = prepressConfig.machine_id || null;
        const machineName = prepressConfig.machine_id ? machineMap.get(prepressConfig.machine_id) : null;
        taskList.push({
            name: prepressConfig.name,
            description: prepressConfig.description || 'Check artwork files, preflight & colour profile verification',
            machine_id: machineId,
            machine_name: machineName,
            display_order: prepressConfig.display_order,
            estimated_minutes: prepressConfig.estimated_minutes !== null ? prepressConfig.estimated_minutes : 15
        });
    }

    // 2. Services Config
    const serviceConfig = configs.find(c => c.task_key === 'service');
    if (serviceConfig && serviceConfig.is_enabled) {
        for (const item of lineItems) {
            const itemQty = parseFloat(item.quantity) || 1;
            const itemServices = item.services || [];
            for (const s of itemServices) {
                let estMins = null;
                const multiplyBy = parseFloat(s.multiply_by) || 1;
                const totalTaskQty = multiplyBy * itemQty;
                if (s.rate_unit && (String(s.rate_unit).toLowerCase().includes('hour') || String(s.rate_unit).toLowerCase().includes('hr'))) {
                    estMins = Math.round(multiplyBy * itemQty * 60);
                }
                taskList.push({
                    name: s.employee_name ? `${serviceConfig.name}: ${s.service_name} — ${s.employee_name}` : `${serviceConfig.name}: ${s.service_name}`,
                    description: `Unit: ${s.rate_unit} · Rate: ${s.rate} · Mult: ${multiplyBy} · Item Qty: ${itemQty} · Note: ${s.note || ''}`.trim(),
                    assigned_to: s.employee_name || null,
                    machine_id: serviceConfig.machine_id || null,
                    machine_name: serviceConfig.machine_id ? machineMap.get(serviceConfig.machine_id) : null,
                    display_order: serviceConfig.display_order,
                    estimated_minutes: serviceConfig.estimated_minutes !== null ? Math.round(serviceConfig.estimated_minutes * itemQty) : estMins,
                    quantity: totalTaskQty
                });
            }
        }
    }

    // 3. Plate Making Config
    const plateMakingConfig = configs.find(c => c.task_key === 'plate_making');
    if (plateMakingConfig && plateMakingConfig.is_enabled) {
        for (const item of lineItems) {
            const itemName = item.estimation_name || item.job_description || `Item ${item.id}`;
            const offsetDetails = item.details?.filter(detail => detail.type === 'offset' && (detail.component_name || itemName) !== 'Finishing' && detail.machine_name) || [];

            if (offsetDetails.length === 0) continue;

            const machineId = plateMakingConfig.machine_id || ctpMachine?.id || null;
            const machineName = plateMakingConfig.machine_id ? machineMap.get(plateMakingConfig.machine_id) : (ctpMachine?.name || null);

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

    // 4. Offset Printing Config
    for (const item of lineItems) {
        const itemName = item.estimation_name || item.job_description || `Item ${item.id}`;
        const offsetDetails = item.details?.filter(detail => detail.type === 'offset' && (detail.component_name || itemName) !== 'Finishing' && detail.machine_name) || [];

        if (offsetDetails.length === 0) continue;

        // Group by print config
        const grouped = {};
        for (const detail of offsetDetails) {
            const machine = detail.machine_name;
            const specificPrintConfig = configs.find(c =>
                (detail.machine_id && c.task_key === `machine_${detail.machine_id}`) ||
                (machine && c.name.toLowerCase() === machine.toLowerCase())
            );
            const printConfig = specificPrintConfig || {
                name: `Offset Printing — ${machine}`,
                display_order: 40,
                is_bb_separated: 1,
                estimated_minutes: null,
                is_enabled: 1
            };

            if (!printConfig.is_enabled) continue;

            const printName = printConfig.name;
            if (!grouped[printName]) {
                grouped[printName] = {
                    config: printConfig,
                    items: []
                };
            }
            grouped[printName].items.push({ detail, config: printConfig });
        }

        for (const printName of Object.keys(grouped)) {
            const group = grouped[printName];
            const printConfig = group.config;

            if (printConfig.is_bb_separated) {
                for (const g of group.items) {
                    const detail = g.detail;
                    const compName = detail.component_name || itemName;
                    const machine = detail.machine_name;

                    const totalCutSheets = getComponentTotalCutSheets(detail, item.quantity);
                    const totalImpressions = parseFloat(detail.printed_sheets) || 0;
                    const offsetSpeed = parseFloat(detail.machine_speed) || 0;
                    const speedUnit = detail.machine_speed_unit || 'Sheets/Hr';
                    const sidesVal = parseInt(detail.sides) || 1;
                    const pagesVal = parseInt(detail.pages) || 1;
                    const upsVal = parseInt(detail.ups) || 1;
                    const colorsVal = parseInt(detail.colors || detail.colors_front || 4);
                    const colorsFront = parseInt(detail.colors_front || detail.colors || 4);
                    const isBB = parseInt(detail.is_bb) === 1;

                    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
                    const computedPlateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);
                    const plateCount = computedPlateCount;

                    const makeReady = parseFloat(detail.machine_make_ready_minutes) || 0;
                    const plateSetupMins = plateCount * (parseFloat(detail.machine_setup_minutes_per_plate) || 0);
                    const totalMakeReady = makeReady + plateSetupMins;

                    const runQty = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: item.quantity
                    });

                    let offsetEstMins = null;
                    if (offsetSpeed > 0) {
                        offsetEstMins = Math.ceil((runQty / offsetSpeed) * 60) + totalMakeReady;
                    }
                    const finalMins = printConfig.estimated_minutes !== null ? printConfig.estimated_minutes : offsetEstMins;

                    taskList.push({
                        name: `${printName} — ${compName} — ${itemName}`,
                        description: `${totalCutSheets} sheets · ${detail.ups || 1} ups · ${detail.sides === 2 ? 'double sided' : 'single sided'}`.trim(),
                        machine_id: detail.machine_id || null,
                        machine_name: machine || null,
                        display_order: printConfig.display_order,
                        estimated_minutes: finalMins,
                        quantity: runQty,
                        sheet_count: totalCutSheets,
                        impression_count: totalImpressions
                    });
                }
            } else {
                // Combine
                let combinedQty = 0;
                let combinedSheets = 0;
                let combinedImpressions = 0;
                let combinedMins = 0;
                let hasCalculatedMins = false;
                const firstDetail = group.items[0]?.detail;

                if (!firstDetail) continue;

                for (const g of group.items) {
                    const detail = g.detail;
                    const totalCutSheets = getComponentTotalCutSheets(detail, item.quantity);
                    const totalImpressions = parseFloat(detail.printed_sheets) || 0;
                    const offsetSpeed = parseFloat(detail.machine_speed) || 0;
                    const speedUnit = detail.machine_speed_unit || 'Sheets/Hr';
                    const sidesVal = parseInt(detail.sides) || 1;
                    const pagesVal = parseInt(detail.pages) || 1;
                    const upsVal = parseInt(detail.ups) || 1;
                    const colorsVal = parseInt(detail.colors || detail.colors_front || 4);
                    const colorsFront = parseInt(detail.colors_front || detail.colors || 4);
                    const isBB = parseInt(detail.is_bb) === 1;

                    const forms = (upsVal * sidesVal) > 0 ? Math.ceil(pagesVal / (upsVal * sidesVal)) : 0;
                    const computedPlateCount = isBB ? parseInt(colorsFront) : (forms * colorsVal);
                    const plateCount = computedPlateCount;

                    const makeReady = parseFloat(detail.machine_make_ready_minutes) || 0;
                    const plateSetupMins = plateCount * (parseFloat(detail.machine_setup_minutes_per_plate) || 0);
                    const totalMakeReady = makeReady + plateSetupMins;

                    const runQty = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: item.quantity
                    });

                    combinedQty += runQty;
                    combinedSheets += totalCutSheets;
                    combinedImpressions += totalImpressions;

                    let offsetEstMins = null;
                    if (offsetSpeed > 0) {
                        offsetEstMins = Math.ceil((runQty / offsetSpeed) * 60) + totalMakeReady;
                        combinedMins += offsetEstMins;
                        hasCalculatedMins = true;
                    }
                }

                const finalMins = printConfig.estimated_minutes !== null ? printConfig.estimated_minutes : (hasCalculatedMins ? combinedMins : null);

                taskList.push({
                    name: `${printName} — ${itemName}`,
                    description: `${combinedSheets} sheets total · ${combinedImpressions} impressions total`,
                    machine_id: firstDetail.machine_id || null,
                    machine_name: firstDetail.machine_name || null,
                    display_order: printConfig.display_order,
                    estimated_minutes: finalMins,
                    quantity: combinedQty,
                    sheet_count: combinedSheets,
                    impression_count: combinedImpressions
                });
            }
        }
    }

    // 5. Digital Print Config
    for (const item of lineItems) {
        const itemName = item.estimation_name || item.job_description || `Item ${item.id}`;
        const digitalDetails = item.details?.filter(detail => detail.type === 'digital' && detail.machine_name) || [];

        if (digitalDetails.length === 0) continue;

        // Group by print config
        const grouped = {};
        for (const detail of digitalDetails) {
            const machine = detail.machine_name;
            const specificPrintConfig = configs.find(c =>
                (detail.machine_id && c.task_key === `machine_${detail.machine_id}`) ||
                (machine && c.name.toLowerCase() === machine.toLowerCase())
            );
            const printConfig = specificPrintConfig || {
                name: `Digital Print — ${machine}`,
                display_order: 50,
                is_bb_separated: 0,
                estimated_minutes: null,
                is_enabled: 1
            };

            if (!printConfig.is_enabled) continue;

            const printName = printConfig.name;
            if (!grouped[printName]) {
                grouped[printName] = {
                    config: printConfig,
                    items: []
                };
            }
            grouped[printName].items.push({ detail, config: printConfig });
        }

        for (const printName of Object.keys(grouped)) {
            const group = grouped[printName];
            const printConfig = group.config;

            if (printConfig.is_bb_separated) {
                for (const g of group.items) {
                    const detail = g.detail;
                    const compName = detail.component_name || itemName;
                    const machine = detail.machine_name;

                    const totalCutSheets = getComponentTotalCutSheets(detail, item.quantity);
                    const totalImpressions = parseFloat(detail.printed_sheets) || 0;
                    const digitalSpeed = parseFloat(detail.machine_speed) || 0;
                    const speedUnit = detail.machine_speed_unit || 'Sheets/Hr';
                    const sidesVal = parseInt(detail.sides) || 1;
                    const makeReady = parseFloat(detail.machine_make_ready_minutes) || 0;

                    const runQty = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: item.quantity
                    });

                    let digitalEstMins = null;
                    if (digitalSpeed > 0) {
                        digitalEstMins = Math.ceil((runQty / digitalSpeed) * 60) + makeReady;
                    }
                    const finalMins = printConfig.estimated_minutes !== null ? printConfig.estimated_minutes : digitalEstMins;

                    taskList.push({
                        name: `${printName} — ${compName} — ${itemName}`,
                        description: `${totalCutSheets} sheets · ${detail.sides === 2 ? 'double sided' : 'single sided'}`.trim(),
                        machine_id: detail.machine_id || null,
                        machine_name: machine || null,
                        display_order: printConfig.display_order,
                        estimated_minutes: finalMins,
                        quantity: runQty,
                        sheet_count: totalCutSheets,
                        impression_count: totalImpressions
                    });
                }
            } else {
                // Combine
                let combinedQty = 0;
                let combinedSheets = 0;
                let combinedImpressions = 0;
                let combinedMins = 0;
                let hasCalculatedMins = false;
                const firstDetail = group.items[0]?.detail;

                if (!firstDetail) continue;

                for (const g of group.items) {
                    const detail = g.detail;
                    const totalCutSheets = getComponentTotalCutSheets(detail, item.quantity);
                    const totalImpressions = parseFloat(detail.printed_sheets) || 0;
                    const digitalSpeed = parseFloat(detail.machine_speed) || 0;
                    const speedUnit = detail.machine_speed_unit || 'Sheets/Hr';
                    const sidesVal = parseInt(detail.sides) || 1;
                    const makeReady = parseFloat(detail.machine_make_ready_minutes) || 0;

                    const runQty = resolveRunQty(speedUnit, {
                        totalCutSheets,
                        sidesVal,
                        totalImpressions,
                        itemQty: item.quantity
                    });

                    combinedQty += runQty;
                    combinedSheets += totalCutSheets;
                    combinedImpressions += totalImpressions;

                    let digitalEstMins = null;
                    if (digitalSpeed > 0) {
                        digitalEstMins = Math.ceil((runQty / digitalSpeed) * 60) + makeReady;
                        combinedMins += digitalEstMins;
                        hasCalculatedMins = true;
                    }
                }

                const finalMins = printConfig.estimated_minutes !== null ? printConfig.estimated_minutes : (hasCalculatedMins ? combinedMins : null);

                taskList.push({
                    name: `${printName} — ${itemName}`,
                    description: `${combinedSheets} sheets total · ${combinedImpressions} impressions total`,
                    machine_id: firstDetail.machine_id || null,
                    machine_name: firstDetail.machine_name || null,
                    display_order: printConfig.display_order,
                    estimated_minutes: finalMins,
                    quantity: combinedQty,
                    sheet_count: combinedSheets,
                    impression_count: combinedImpressions
                });
            }
        }
    }

    // 6. Finishings Config
    for (const item of lineItems) {
        const itemName = item.estimation_name || item.job_description || `Item ${item.id}`;
        const finishings = item.finishings || [];

        // Group all finishings by taskNameBase
        const grouped = {};
        for (const f of finishings) {
            const specificFinishingConfig = configs.find(c =>
                (c.task_key.startsWith('finishing_') && f.name && c.name.toLowerCase() === f.name.toLowerCase()) ||
                (f.machine_name && c.name.toLowerCase() === f.machine_name.toLowerCase()) ||
                (f.machine_id && c.task_key === `machine_${f.machine_id}`)
            );
            const finConfig = specificFinishingConfig || {
                name: f.name,
                display_order: 60,
                is_bb_separated: 0,
                estimated_minutes: null,
                is_enabled: 1
            };

            if (!finConfig.is_enabled) continue;

            const taskNameBase = finConfig.name;
            if (!grouped[taskNameBase]) {
                grouped[taskNameBase] = {
                    config: finConfig,
                    items: []
                };
            }
            grouped[taskNameBase].items.push({ finishing: f, config: finConfig });
        }

        // For each group, either split or combine
        for (const taskNameBase of Object.keys(grouped)) {
            const group = grouped[taskNameBase];
            const finConfig = group.config;

            if (finConfig.is_bb_separated) {
                // Separate: make each finishing a separate task per component
                for (const g of group.items) {
                    const f = g.finishing;
                    const matchingDetail = item.details?.find(d => d.id === f.quotation_item_detail_id);
                    const compName = (matchingDetail?.component_name || f.component_name || 'Finishings').trim();

                    const speedUnit = f.speed_unit || f.machine_speed_unit || f.cost_unit || '';
                    const su = speedUnit.toLowerCase().trim();
                    const itemQty = parseFloat(item.quantity) || 0;
                    let runQty = parseFloat(f.quantity) || 0;

                    if (su.includes('unit')) {
                        runQty = itemQty;
                    } else if (matchingDetail) {
                        const isBB = parseInt(matchingDetail.is_bb) === 1;
                        if (isBB && su.includes('form')) {
                            runQty = itemQty;
                        } else {
                            const pagesVal = parseInt(matchingDetail.pages) || 1;
                            const upsVal = parseInt(matchingDetail.ups) || 1;
                            const sidesVal = parseInt(matchingDetail.sides) || 1;
                            const divisor = upsVal * sidesVal;
                            let netCutSheets = parseFloat(matchingDetail.printed_sheets) || 0;
                            if (divisor > 0 && itemQty > 0) {
                                netCutSheets = Math.ceil((pagesVal * itemQty) / divisor);
                            }
                            const totalCutSheets = netCutSheets + (parseFloat(matchingDetail.wastage_sheets) || 0);

                            if (su.includes('print')) {
                                runQty = totalCutSheets * sidesVal;
                            } else if (su.includes('sheet')) {
                                runQty = totalCutSheets;
                            }
                        }
                    }

                    const speed = parseFloat(f.speed) || 0;
                    let estMins = null;
                    if (f.total_time && parseFloat(f.total_time) > 0) {
                        estMins = Math.round(parseFloat(f.total_time) * 60);
                    } else if (runQty && speed) {
                        estMins = Math.ceil((runQty / speed) * 60);
                    }
                    const finalMins = finConfig.estimated_minutes !== null ? finConfig.estimated_minutes : estMins;

                    const finalName = `${taskNameBase} — ${compName} — ${itemName}`;

                    taskList.push({
                        name: finalName,
                        description: f.machine_name ? `Machine: ${f.machine_name}` : null,
                        machine_id: f.machine_id || finConfig.machine_id || null,
                        machine_name: f.machine_name || (finConfig.machine_id ? machineMap.get(finConfig.machine_id) : null) || null,
                        display_order: finConfig.display_order,
                        estimated_minutes: finalMins,
                        quantity: runQty
                    });
                }
            } else {
                // Combine all finishings for this taskNameBase in this item
                let combinedQty = 0;
                let combinedEstMins = 0;
                let hasCalculatedEstMins = false;
                const firstFinishing = group.items[0]?.finishing;

                if (!firstFinishing) continue;

                for (const g of group.items) {
                    const f = g.finishing;
                    const matchingDetail = item.details?.find(d => d.id === f.quotation_item_detail_id);
                    const speedUnit = f.speed_unit || f.machine_speed_unit || f.cost_unit || '';
                    const su = speedUnit.toLowerCase().trim();
                    const itemQty = parseFloat(item.quantity) || 0;
                    let runQty = parseFloat(f.quantity) || 0;

                    if (su.includes('unit')) {
                        runQty = itemQty;
                    } else if (matchingDetail) {
                        const isBB = parseInt(matchingDetail.is_bb) === 1;
                        if (isBB && su.includes('form')) {
                            runQty = itemQty;
                        } else {
                            const pagesVal = parseInt(matchingDetail.pages) || 1;
                            const upsVal = parseInt(matchingDetail.ups) || 1;
                            const sidesVal = parseInt(matchingDetail.sides) || 1;
                            const divisor = upsVal * sidesVal;
                            let netCutSheets = parseFloat(matchingDetail.printed_sheets) || 0;
                            if (divisor > 0 && itemQty > 0) {
                                netCutSheets = Math.ceil((pagesVal * itemQty) / divisor);
                            }
                            const totalCutSheets = netCutSheets + (parseFloat(matchingDetail.wastage_sheets) || 0);

                            if (su.includes('print')) {
                                runQty = totalCutSheets * sidesVal;
                            } else if (su.includes('sheet')) {
                                runQty = totalCutSheets;
                            }
                        }
                    }

                    combinedQty += runQty;

                    const speed = parseFloat(f.speed) || 0;
                    let estMins = null;
                    if (f.total_time && parseFloat(f.total_time) > 0) {
                        estMins = Math.round(parseFloat(f.total_time) * 60);
                    } else if (runQty && speed) {
                        estMins = Math.ceil((runQty / speed) * 60);
                    }
                    if (estMins !== null) {
                        combinedEstMins += estMins;
                        hasCalculatedEstMins = true;
                    }
                }

                const finalMins = finConfig.estimated_minutes !== null
                    ? finConfig.estimated_minutes
                    : (hasCalculatedEstMins ? combinedEstMins : null);

                const matchingDetail = item.details?.find(d => d.id === firstFinishing.quotation_item_detail_id);
                const compName = (matchingDetail?.component_name || firstFinishing.component_name || 'Finishings').trim();

                taskList.push({
                    name: `${taskNameBase} — ${compName} — ${itemName}`,
                    description: firstFinishing.machine_name ? `Machine: ${firstFinishing.machine_name}` : null,
                    machine_id: firstFinishing.machine_id || finConfig.machine_id || null,
                    machine_name: firstFinishing.machine_name || (finConfig.machine_id ? machineMap.get(finConfig.machine_id) : null) || null,
                    display_order: finConfig.display_order,
                    estimated_minutes: finalMins,
                    quantity: combinedQty
                });
            }
        }
    }

    // 7. Quality Check Config
    const qcConfig = configs.find(c => c.task_key === 'quality_check');
    if (qcConfig && qcConfig.is_enabled) {
        taskList.push({
            name: qcConfig.name,
            description: qcConfig.description || 'Inspect quality of printed items',
            machine_id: qcConfig.machine_id || null,
            machine_name: qcConfig.machine_id ? machineMap.get(qcConfig.machine_id) : null,
            display_order: qcConfig.display_order,
            estimated_minutes: qcConfig.estimated_minutes
        });
    }

    // 8. Packing Config
    const packingConfig = configs.find(c => c.task_key === 'packing');
    if (packingConfig && packingConfig.is_enabled) {
        taskList.push({
            name: packingConfig.name,
            description: packingConfig.description || 'Pack items for delivery',
            machine_id: packingConfig.machine_id || null,
            machine_name: packingConfig.machine_id ? machineMap.get(packingConfig.machine_id) : null,
            display_order: packingConfig.display_order,
            estimated_minutes: packingConfig.estimated_minutes
        });
    }

    // 9. Delivery Config
    const deliveryConfig = configs.find(c => c.task_key === 'delivery');
    if (deliveryConfig && deliveryConfig.is_enabled) {
        taskList.push({
            name: deliveryConfig.name,
            description: deliveryConfig.description || 'Deliver to customer',
            machine_id: deliveryConfig.machine_id || null,
            machine_name: deliveryConfig.machine_id ? machineMap.get(deliveryConfig.machine_id) : null,
            display_order: deliveryConfig.display_order,
            estimated_minutes: deliveryConfig.estimated_minutes
        });
    }

    // 10. Custom configurations (always generated additional default tasks)
    const customConfigs = configs.filter(c => c.task_key === 'custom');
    for (const cc of customConfigs) {
        if (cc.is_enabled) {
            taskList.push({
                name: cc.name,
                description: cc.description || null,
                machine_id: cc.machine_id || null,
                machine_name: cc.machine_id ? machineMap.get(cc.machine_id) : null,
                display_order: cc.display_order,
                estimated_minutes: cc.estimated_minutes
            });
        }
    }

    // Sort taskList by their configured display_order
    taskList.sort((a, b) => a.display_order - b.display_order);

    // Re-assign display_order sequentially 0, 1, 2...
    taskList.forEach((t, index) => {
        t.display_order = index;
    });

    // Insert into DB
    for (const t of taskList) {
        await pool.execute(
            'INSERT INTO job_tasks (sales_order_id, name, description, machine_id, machine_name, assigned_to, display_order, estimated_minutes, quantity, sheet_count, impression_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [parseInt(id), t.name, t.description || null, t.machine_id || null, t.machine_name || null, t.assigned_to || null, t.display_order, t.estimated_minutes || null, t.quantity || null, t.sheet_count || null, t.impression_count || null]
        );
    }

    const [inserted] = await pool.execute(
        'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC',
        [id]
    );
    return inserted;
}

// ─── Helper to resolve code or ID to numeric ID ─────────────────────────────
async function getSalesOrderId(idOrCode) {
    if (!idOrCode || idOrCode === 'unassigned' || idOrCode === 'null' || idOrCode === 'undefined' || idOrCode === '0') {
        return null;
    }
    if (!isNaN(idOrCode)) {
        return parseInt(idOrCode);
    }
    const [orders] = await pool.execute('SELECT id FROM sales_orders WHERE code = ?', [idOrCode]);
    return orders[0]?.id || null;
}

export async function GET(req, { params }) {
    try {
        const resolvedParams = await params;
        const rawId = resolvedParams?.id;
        if (!rawId || rawId === 'undefined' || rawId === 'null') {
            return NextResponse.json({ error: 'Invalid or missing Sales Order ID' }, { status: 400 });
        }

        const id = await getSalesOrderId(rawId);
        if (!id) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const [tasks] = await pool.execute(
            `SELECT jt.*, m.type AS machine_type 
             FROM job_tasks jt
             LEFT JOIN machines m ON jt.machine_id = m.id
             WHERE jt.sales_order_id = ? 
             ORDER BY jt.display_order ASC, jt.id ASC`,
            [id]
        );
        const enrichedTasks = await enrichTasksWithEstimationDetailsForGet(tasks, [id]);
        return NextResponse.json(enrichedTasks);
    } catch (err) {
        console.error('Tasks GET error stack trace:', err.stack || err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function enrichTasksWithEstimationDetailsForGet(tasks, orderIds) {
    if (!tasks || !tasks.length || !orderIds || !orderIds.length) return tasks;

    const placeholders = orderIds.map(() => '?').join(',');
    const [details] = await pool.execute(
        `SELECT qid.*, qi.quantity AS item_qty, so.id AS sales_order_id,
                m.setup_minutes_per_plate, m.make_ready_minutes, m.type AS machine_type
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
        const taskName = task.name || '';
        const isOffset = taskName.toLowerCase().includes('offset printing') || (task.machine_type || '').toLowerCase() === 'offset';
        const isDigital = taskName.toLowerCase().includes('digital print') || (task.machine_type || '').toLowerCase() === 'digital';
        const isPrepress = (task.machine_type || '').toLowerCase() === 'prepress' || taskName.toLowerCase().includes('plate making') || taskName.toLowerCase().includes('pre-press');

        if (isOffset || isDigital || isPrepress) {
            const parts = taskName.split(' — ');
            const compName = (parts.length >= 3 ? parts[1] : '') || '';

            let bestDetail = null;
            let bestScore = -1;

            for (const d of details) {
                if (d.sales_order_id !== task.sales_order_id) continue;

                let score = 0;

                // Check component name match
                if (compName && d.component_name) {
                    const c1 = compName.toLowerCase().trim();
                    const c2 = d.component_name.toLowerCase().trim();
                    if (c1 === c2) {
                        score += 20;
                    } else if (c1.includes(c2) || c2.includes(c1)) {
                        score += 10;
                    }
                }

                // Check machine_id match
                if (task.machine_id && d.machine_id && task.machine_id === d.machine_id) {
                    score += 5;
                }

                // Check type match
                const typeMatch = (isOffset && d.type === 'offset') || (isDigital && d.type === 'digital') || (isPrepress && d.type === 'offset');
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
                if (isPrepress) {
                    if (task.quantity == null || task.quantity === 0 || !task.is_manual) {
                        task.quantity = computedPlateCount;
                    }
                } else if (task.quantity == null || task.quantity === 0) {
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
            // Match finishing
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

                // If component name is in the task, match it with detail component name
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
    return tasks;
}

export async function POST(req, { params }) {
    try {
        const resolvedParams = await params;
        const rawId = resolvedParams?.id;
        if (!rawId || rawId === 'undefined' || rawId === 'null') {
            return NextResponse.json({ error: 'Invalid or missing Sales Order ID' }, { status: 400 });
        }

        const isUnassigned = rawId === 'unassigned' || rawId === '0' || rawId === 'none';
        const id = isUnassigned ? null : await getSalesOrderId(rawId);
        if (!isUnassigned && !id) {
            return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
        }

        const body = await req.json();

        // Auto-generate from job components (machine-aware)
        if (body.generateDefaults || body.generateFromJob) {
            if (!id) return NextResponse.json({ error: 'Sales Order required for auto-generating tasks' }, { status: 400 });
            const tasks = await generateJobTasks(id);
            const enrichedTasks = await enrichTasksWithEstimationDetailsForGet(tasks, [id]);
            return NextResponse.json(enrichedTasks);
        }

        // Create single task
        const { name, description, assigned_to, scheduled_date, display_order, estimated_minutes, machine_id, machine_name, quantity } = body;
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        const [result] = await pool.execute(
            'INSERT INTO job_tasks (sales_order_id, name, description, machine_id, machine_name, assigned_to, scheduled_date, display_order, estimated_minutes, quantity, is_manual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [id, name, description || null, machine_id || null, machine_name || null, assigned_to || null, scheduled_date || null, display_order ?? 99, estimated_minutes || null, quantity || null]
        );
        const [task] = await pool.execute('SELECT * FROM job_tasks WHERE id = ?', [result.insertId]);
        return NextResponse.json(task[0]);
    } catch (err) {
        console.error('Tasks POST error stack trace:', err.stack || err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

