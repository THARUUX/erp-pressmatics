import pool from '../lib/db.js';

async function run() {
    const conn = await pool.getConnection();
    try {
        await conn.execute(`
            ALTER TABLE competitor_analyses 
            ADD COLUMN IF NOT EXISTS usd_rate DECIMAL(10,4) NULL 
            COMMENT '1 USD = X local currency at time of analysis'
        `);
        console.log('✅ usd_rate column added to competitor_analyses');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  Already exists.');
        else { console.error(e.message); }
    } finally {
        conn.release();
        process.exit(0);
    }
}
run();
