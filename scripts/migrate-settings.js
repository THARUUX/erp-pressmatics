const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press'
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log("Setting up Settings Table...");

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Seed default currency
        const [rows] = await connection.execute("SELECT * FROM settings WHERE setting_key = 'currency'");
        if (rows.length === 0) {
            console.log("Seeding default currency...");
            await connection.execute(`
                INSERT INTO settings (setting_key, setting_value) VALUES ('currency', '$')
            `);
        }

        console.log("Settings table setup complete.");

    } catch (error) {
        console.error("Migration Failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
