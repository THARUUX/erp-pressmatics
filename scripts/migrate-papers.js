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
        console.log("Setting up Papers Table...");

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS papers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(100) DEFAULT 'Art Paper',
                cost_per_sheet DECIMAL(10,4) DEFAULT 0.00,
                stock_quantity INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed some papers
        const [rows] = await connection.execute("SELECT COUNT(*) as count FROM papers");
        if (rows[0].count === 0) {
            console.log("Seeding initial papers...");
            await connection.execute(`
                INSERT INTO papers (name, type, cost_per_sheet, stock_quantity) VALUES 
                ('Art Paper 130gsm', 'Art', 0.05, 5000),
                ('Art Board 300gsm', 'Board', 0.12, 2000),
                ('Bond Paper 80gsm', 'Bond', 0.02, 10000)
            `);
        }

        console.log("Papers table setup complete.");

    } catch (error) {
        console.error("Migration Failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
