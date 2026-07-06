import pool from './lib/db.js';

async function main() {
    try {
        const [orders] = await pool.execute('SELECT id, code FROM sales_orders LIMIT 5');
        console.log('Orders:', orders);
        if (orders.length > 0) {
            const orderId = orders[0].id;
            const [tasks] = await pool.execute(
                'SELECT * FROM job_tasks WHERE sales_order_id = ? ORDER BY display_order ASC, id ASC',
                [orderId]
            );
            console.log(`Tasks for Order ${orderId}:`, tasks);
        }
        process.exit(0);
    } catch (e) {
        console.error('Error running query:', e);
        process.exit(1);
    }
}
main();
