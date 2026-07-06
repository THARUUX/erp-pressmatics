import pool from '../lib/db.js';

async function migrate() {
    console.log("Starting database migration to add scheduled_date to job_tasks...");
    try {
        // Check if column already exists
        const [cols] = await pool.execute('SHOW COLUMNS FROM job_tasks LIKE "scheduled_date"');
        if (cols.length > 0) {
            console.log("Column 'scheduled_date' already exists in 'job_tasks'.");
            process.exit(0);
        }

        // Add column
        await pool.execute('ALTER TABLE job_tasks ADD COLUMN scheduled_date DATE NULL');
        console.log("Successfully added column 'scheduled_date' to 'job_tasks' table!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
