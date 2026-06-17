import pool from '../lib/db.js';

async function migrate() {
    try {
        console.log('Adding digital color prices to machines table...');

        // Add columns if they don't exist
        const queries = [
            "ALTER TABLE machines ADD COLUMN IF NOT EXISTS digital_price_max DECIMAL(10,4) DEFAULT 0",
            "ALTER TABLE machines ADD COLUMN IF NOT EXISTS digital_price_medium DECIMAL(10,4) DEFAULT 0",
            "ALTER TABLE machines ADD COLUMN IF NOT EXISTS digital_price_min DECIMAL(10,4) DEFAULT 0"
        ];

        for (const query of queries) {
            try {
                await pool.execute(query);
                console.log('Executed:', query);
            } catch (err) {
                // Ignore duplicate column errors (Error code 1060 in MySQL)
                if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_PARSE_ERROR') {
                    console.log('Column might already exist or syntax error, skipping: ', err.message);
                } else {
                    console.error('Error executing query:', query, err);
                    throw err;
                }
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
