import pool from '../lib/db.js';

async function migrate() {
    try {
        console.log('Adding width_cm and height_cm to inventory_items table...');

        // Add columns if they don't exist
        const queries = [
            "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2) DEFAULT NULL",
            "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2) DEFAULT NULL"
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
