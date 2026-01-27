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
        console.log("Adding 'speed' to machines table...");

        // Check if column exists first
        const [columns] = await connection.execute("SHOW COLUMNS FROM machines LIKE 'speed'");
        if (columns.length === 0) {
            await connection.execute(`
                ALTER TABLE machines
                ADD COLUMN speed INT DEFAULT 0
            `);
            console.log("Column 'speed' added.");
        } else {
            console.log("Column 'speed' already exists.");
        }

    } catch (error) {
        console.error("Migration Failed:", error);
    } finally {
        await connection.end();
    }
}

migrate();
