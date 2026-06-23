import pool from '../lib/db.js';

async function run() {
    const conn = await pool.getConnection();
    try {
        // Add usd_rate to competitor_entries if not exists
        await conn.execute(`
            ALTER TABLE competitor_entries 
            ADD COLUMN IF NOT EXISTS usd_rate DECIMAL(10,4) NULL 
            COMMENT '1 USD = X local currency at time of entry'
        `);
        console.log('✅ usd_rate column added to competitor_entries');
    } catch (e) {
        // Column may already exist on some MySQL versions without IF NOT EXISTS support
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️  usd_rate already exists, skipping.');
        } else {
            console.error('Failed:', e.message);
        }
    } finally {
        conn.release();
        process.exit(0);
    }
}
run();
