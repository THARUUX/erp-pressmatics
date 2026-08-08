import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com',
    port: parseInt(process.env.DB_PORT || '4000'),
    user: process.env.DB_USERNAME || 'urodvqgtAbDHKxM.root',
    password: process.env.DB_PASSWORD || 'beZ9NcUqVGbRV2nw',
    database: process.env.DB_DATABASE || 'erp_press',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
});

// 1. Identify the Graphic Design service
const [services] = await pool.execute(
    `SELECT id, name FROM services WHERE name LIKE '%graphic%' OR name LIKE '%Graphic%' ORDER BY id ASC LIMIT 1`
);
if (services.length === 0) { console.error('Service not found!'); await pool.end(); process.exit(1); }

const svcId = services[0].id;
const svcName = services[0].name;
console.log(`\n→ Service: [${svcId}] "${svcName}"\n`);

// ── 2. CLEAR TASKS ─────────────────────────────────────────────────────────
const [tasks] = await pool.execute(
    `SELECT id FROM job_tasks WHERE service_id = ? OR name LIKE ?`,
    [svcId, `Service: ${svcName}%`]
);
const taskIds = tasks.map(t => t.id);
if (taskIds.length > 0) {
    await pool.execute(
        `DELETE FROM job_task_work_logs WHERE task_id IN (${taskIds.map(() => '?').join(',')})`,
        taskIds
    );
    await pool.execute(
        `DELETE FROM job_tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`,
        taskIds
    );
    console.log(`✅ Deleted ${taskIds.length} tasks + work logs.`);
} else {
    console.log('ℹ️  No tasks found.');
}

// ── 3. CLEAR QUOTATIONS ────────────────────────────────────────────────────
const [quotations] = await pool.execute(
    `SELECT id FROM quotations WHERE service_id = ?`, [svcId]
);
const qIds = quotations.map(q => q.id);
if (qIds.length > 0) {
    const [lineItems] = await pool.execute(
        `SELECT DISTINCT quotation_item_id FROM quotation_line_items WHERE quotation_id IN (${qIds.map(() => '?').join(',')})`,
        qIds
    );
    const itemIds = lineItems.map(li => li.quotation_item_id);

    await pool.execute(
        `DELETE FROM quotation_line_items WHERE quotation_id IN (${qIds.map(() => '?').join(',')})`,
        qIds
    );
    if (itemIds.length > 0) {
        await pool.execute(
            `DELETE FROM quotation_items WHERE id IN (${itemIds.map(() => '?').join(',')})`,
            itemIds
        );
    }
    await pool.execute(
        `DELETE FROM quotations WHERE id IN (${qIds.map(() => '?').join(',')})`,
        qIds
    );
    console.log(`✅ Deleted ${qIds.length} quotations + ${itemIds.length} items.`);
} else {
    console.log('ℹ️  No quotations found.');
}

// ── 4. CLEAR SALES ORDERS linked to this service ───────────────────────────
// Sales orders may be linked via service_id on job_tasks or via quotations
// Find SOs that only have tasks from this service, and any invoices linked

// First get any SO IDs from tasks we already deleted
const [soRows] = await pool.execute(
    `SELECT DISTINCT sales_order_id FROM job_tasks WHERE service_id = ? AND sales_order_id IS NOT NULL`,
    [svcId]
);
// Also look up SOs that came from the service's quotations
const [soFromQuotes] = await pool.execute(
    `SELECT DISTINCT so.id FROM sales_orders so
     INNER JOIN quotations q ON so.quotation_id = q.id
     WHERE q.service_id = ?`,
    [svcId]
);

const soIds = [...new Set([
    ...soRows.map(r => r.sales_order_id),
    ...soFromQuotes.map(r => r.id)
])].filter(Boolean);

if (soIds.length > 0) {
    // Delete SO tasks for these SOs
    const [soTasks] = await pool.execute(
        `SELECT id FROM job_tasks WHERE sales_order_id IN (${soIds.map(() => '?').join(',')})`,
        soIds
    );
    const soTaskIds = soTasks.map(t => t.id);
    if (soTaskIds.length > 0) {
        await pool.execute(
            `DELETE FROM job_task_work_logs WHERE task_id IN (${soTaskIds.map(() => '?').join(',')})`,
            soTaskIds
        );
        await pool.execute(
            `DELETE FROM job_tasks WHERE id IN (${soTaskIds.map(() => '?').join(',')})`,
            soTaskIds
        );
    }

    // Delete SO stock issues / items if table exists
    try {
        await pool.execute(
            `DELETE FROM sales_order_items WHERE sales_order_id IN (${soIds.map(() => '?').join(',')})`,
            soIds
        );
    } catch { /* table may not exist */ }

    try {
        await pool.execute(
            `DELETE FROM sales_order_stock_issues WHERE sales_order_id IN (${soIds.map(() => '?').join(',')})`,
            soIds
        );
    } catch { /* table may not exist */ }

    // Delete the sales orders
    await pool.execute(
        `DELETE FROM sales_orders WHERE id IN (${soIds.map(() => '?').join(',')})`,
        soIds
    );
    console.log(`✅ Deleted ${soIds.length} sales orders (IDs: ${soIds.join(', ')}) + ${soTaskIds?.length || 0} linked tasks.`);
} else {
    console.log('ℹ️  No sales orders found linked to this service.');
}

// ── 5. CLEAR INVOICES linked to this service ──────────────────────────────
const [invoices] = await pool.execute(
    `SELECT id FROM invoices WHERE service_id = ?`, [svcId]
);
const invIds = invoices.map(i => i.id);
if (invIds.length > 0) {
    await pool.execute(
        `DELETE FROM invoices WHERE id IN (${invIds.map(() => '?').join(',')})`,
        invIds
    );
    console.log(`✅ Deleted ${invIds.length} invoices.`);
} else {
    console.log('ℹ️  No invoices found.');
}

console.log('\n✅ Service fully cleared. No dummy data inserted.\n');
await pool.end();
