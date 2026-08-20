require('dotenv').config();
const mysql = require('mysql2/promise');

async function createPerformanceIndexes() {
    console.log('--- Database Performance Index Optimization ---');
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: parseInt(process.env.DB_PORT || '4000'),
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    const indexQueries = [
        {
            table: 'job_tasks',
            name: 'idx_job_tasks_planning',
            sql: 'CREATE INDEX idx_job_tasks_planning ON job_tasks (machine_id, scheduled_date, status)'
        },
        {
            table: 'job_tasks',
            name: 'idx_job_tasks_employee_planning',
            sql: 'CREATE INDEX idx_job_tasks_employee_planning ON job_tasks (assigned_to, scheduled_date, status)'
        },
        {
            table: 'sales_orders',
            name: 'idx_sales_orders_planning',
            sql: 'CREATE INDEX idx_sales_orders_planning ON sales_orders (status, delivery_date, kanban_position)'
        },
        {
            table: 'quotation_line_items',
            name: 'idx_quotation_line_items_lookup',
            sql: 'CREATE INDEX idx_quotation_line_items_lookup ON quotation_line_items (quotation_id, quotation_item_id)'
        }
    ];

    for (const item of indexQueries) {
        try {
            const [existing] = await pool.execute(`SHOW INDEX FROM ${item.table} WHERE Key_name = ?`, [item.name]);
            if (existing.length > 0) {
                console.log(`[EXISTING] Index '${item.name}' already exists on table '${item.table}'.`);
            } else {
                console.log(`[CREATING] Creating index '${item.name}' on table '${item.table}'...`);
                await pool.execute(item.sql);
                console.log(`[SUCCESS] Index '${item.name}' created successfully.`);
            }
        } catch (err) {
            console.error(`[ERROR] Failed to process index '${item.name}':`, err.message);
        }
    }

    console.log('\n✅ Database Index Optimization Complete!');
    process.exit(0);
}

createPerformanceIndexes().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
