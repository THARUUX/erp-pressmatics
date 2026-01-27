const mysql = require('mysql2/promise');

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

        console.log("Adding markup_percent column to quotation_items...");

        try {
            await pool.execute('ALTER TABLE quotation_items ADD COLUMN markup_percent DECIMAL(5,2) DEFAULT 0.00');
            console.log("Added markup_percent column.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("markup_percent column already exists.");
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
