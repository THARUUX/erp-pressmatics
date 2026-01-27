const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    try {
        const pool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log("Adding columns to finishings table...");

        // Add speed column
        try {
            await pool.execute('ALTER TABLE finishings ADD COLUMN speed DECIMAL(10,2) DEFAULT NULL');
            console.log("Added speed column.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("speed column already exists.");
            else console.error(e);
        }

        // Add speed_unit column
        try {
            await pool.execute("ALTER TABLE finishings ADD COLUMN speed_unit VARCHAR(50) DEFAULT 'Sheets/Hr'");
            console.log("Added speed_unit column.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("speed_unit column already exists.");
            else console.error(e);
        }

        console.log("Migration complete.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
