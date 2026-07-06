import pool from '../lib/db.js';

async function migrate() {
    console.log("Starting database migration to add estimated_minutes to job_tasks...");
    try {
        // Check if column already exists
        const [cols] = await pool.execute('SHOW COLUMNS FROM job_tasks LIKE "estimated_minutes"');
        if (cols.length > 0) {
            console.log("Column 'estimated_minutes' already exists in 'job_tasks'.");
            process.exit(0);
        }

        // Add column
        await pool.execute('ALTER TABLE job_tasks ADD COLUMN estimated_minutes INT NULL');
        console.log("Successfully added column 'estimated_minutes' to 'job_tasks' table!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
