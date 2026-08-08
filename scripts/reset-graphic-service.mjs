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

// 1. Find the Graphic Design service
const [services] = await pool.execute(
    `SELECT id, name FROM services WHERE name LIKE '%graphic%' OR name LIKE '%Graphic%' OR name LIKE '%design%' ORDER BY id ASC`
);
console.log('Found services:', services);

if (services.length === 0) {
    console.error('No Graphic Design service found!');
    await pool.end();
    process.exit(1);
}

const svcId = services[0].id;
const svcName = services[0].name;
console.log(`\n→ Using service: [${svcId}] "${svcName}"`);

// 2. Find tasks linked to this service
const [tasks] = await pool.execute(
    `SELECT jt.id FROM job_tasks jt WHERE jt.service_id = ? OR jt.name LIKE ?`,
    [svcId, `Service: ${svcName}%`]
);
const taskIds = tasks.map(t => t.id);
console.log(`Found ${taskIds.length} tasks to delete:`, taskIds);

// 3. Delete work logs for those tasks
if (taskIds.length > 0) {
    await pool.execute(
        `DELETE FROM job_task_work_logs WHERE task_id IN (${taskIds.map(() => '?').join(',')})`,
        taskIds
    );
    console.log('Deleted work logs.');

    await pool.execute(
        `DELETE FROM job_tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`,
        taskIds
    );
    console.log('Deleted tasks.');
}

// 4. Delete quotation line items and quotations for this service
const [quotations] = await pool.execute(
    `SELECT id FROM quotations WHERE service_id = ?`, [svcId]
);
const qIds = quotations.map(q => q.id);
console.log(`Found ${qIds.length} quotations to delete.`);

if (qIds.length > 0) {
    // Get all quotation_item_ids linked to these quotations
    const [lineItems] = await pool.execute(
        `SELECT DISTINCT quotation_item_id FROM quotation_line_items WHERE quotation_id IN (${qIds.map(() => '?').join(',')})`,
        qIds
    );
    const itemIds = lineItems.map(li => li.quotation_item_id);

    // Delete line items
    await pool.execute(
        `DELETE FROM quotation_line_items WHERE quotation_id IN (${qIds.map(() => '?').join(',')})`,
        qIds
    );

    // Delete quotation items
    if (itemIds.length > 0) {
        await pool.execute(
            `DELETE FROM quotation_items WHERE id IN (${itemIds.map(() => '?').join(',')})`,
            itemIds
        );
    }

    // Delete quotations
    await pool.execute(
        `DELETE FROM quotations WHERE id IN (${qIds.map(() => '?').join(',')})`,
        qIds
    );
    console.log('Deleted quotations and related items.');
}

// 5. Insert dummy tasks
const dummyTasks = [
    { name: 'Logo Design — Brand Identity Package', customer: 'Dummy Client A', assigned: 'Kasun Perera', estMins: 120, status: 'done', completedAt: '2026-07-28 10:00:00' },
    { name: 'Social Media Post Design — July Campaign', customer: 'Dummy Client B', assigned: 'Nimali Perera', estMins: 90, status: 'in_progress', completedAt: null },
    { name: 'Brochure Layout — Product Catalog 2026', customer: 'Dummy Client C', assigned: 'Kasun Perera', estMins: 180, status: 'pending', completedAt: null },
    { name: 'Banner Design — Trade Show Booth', customer: 'Dummy Client A', assigned: 'Nimali Perera', estMins: 60, status: 'pending', completedAt: null },
    { name: 'Business Card Design — Executive Set', customer: 'Dummy Client D', assigned: null, estMins: 45, status: 'pending', completedAt: null },
];

for (const t of dummyTasks) {
    const description = `Unit: per job · Rate: 0 · Mult: 1 · Note: ${t.name}`;
    const taskName = `Service: ${svcName} — ${t.assigned || 'Unassigned'}`;
    await pool.execute(
        `INSERT INTO job_tasks (name, description, status, assigned_to, estimated_minutes, service_id, customer_name, display_order, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 999, ?, NOW(), NOW())`,
        [taskName, description, t.status, t.assigned, t.estMins, svcId, t.customer, t.completedAt]
    );
    console.log(`  → Inserted task: "${t.name}" [${t.status}]`);
}

// 6. Insert dummy quotations
const dummyQuotes = [
    { customer: 'Dummy Client A', desc: 'Logo Design Package', amount: 15000.00 },
    { customer: 'Dummy Client B', desc: 'Social Media Design - 3 months', amount: 28500.00 },
    { customer: 'Dummy Client C', desc: 'Product Catalog Brochure', amount: 42000.00 },
];

for (const q of dummyQuotes) {
    // Get next quotation code
    const [seqRows] = await pool.execute(`SELECT setting_value FROM settings WHERE setting_key = 'quotation_id_seq'`);
    const [tplRows] = await pool.execute(`SELECT setting_value FROM settings WHERE setting_key = 'quotation_id_template'`);
    let seq = parseInt(seqRows[0]?.setting_value || '1');
    let tpl = tplRows[0]?.setting_value || 'QTN-{0000}';
    const code = tpl.replace('{0000}', String(seq).padStart(4, '0')).replace('{SEQ}', String(seq));

    const [quoteRes] = await pool.execute(
        `INSERT INTO quotations (customer_name, total_amount, job_description, code, quotation_date, status, service_id, show_grand_total, show_signature)
         VALUES (?, ?, ?, ?, NOW(), 'approved', ?, 1, 1)`,
        [q.customer, q.amount, q.desc, code, svcId]
    );
    const quoteId = quoteRes.insertId;

    // Get next item code
    const [itemSeqRows] = await pool.execute(`SELECT setting_value FROM settings WHERE setting_key = 'item_code_seq'`);
    let itemSeq = parseInt(itemSeqRows[0]?.setting_value || '1000');

    const [itemRes] = await pool.execute(
        `INSERT INTO quotation_items (code, estimation_name, customer_name, item_name, job_description, type, quantity, total_amount, subtotal_amount, status, tax_mode, tax_percentage, tax_amount)
         VALUES (?, ?, ?, ?, ?, 'services', 1, ?, ?, 'linked', 'none', 0, 0)`,
        [`ITM-${String(itemSeq).padStart(4, '0')}`, q.desc, q.customer, q.desc, q.desc, q.amount, q.amount]
    );
    const itemId = itemRes.insertId;

    await pool.execute(
        `INSERT INTO quotation_line_items (quotation_id, quotation_item_id, display_order) VALUES (?, ?, 1)`,
        [quoteId, itemId]
    );

    await pool.execute(`UPDATE settings SET setting_value = ? WHERE setting_key = 'quotation_id_seq'`, [String(seq + 1)]);
    await pool.execute(`UPDATE settings SET setting_value = ? WHERE setting_key = 'item_code_seq'`, [String(itemSeq + 1)]);

    console.log(`  → Inserted quotation: "${q.desc}" [${code}] — LKR ${q.amount}`);
}

console.log('\n✅ Done! Graphic Design service data reset with dummy data.');
await pool.end();
