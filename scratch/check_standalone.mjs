import pool from '../lib/db.js';

async function main() {
    try {
        const [tasks] = await pool.execute(
            'SELECT id, sales_order_id, name, description, is_manual FROM job_tasks WHERE sales_order_id IS NULL'
        );
        console.log('Standalone Tasks:', tasks);
        process.exit(0);
    } catch (e) {
        console.error('Error running query:', e);
        process.exit(1);
    }
}
main();
