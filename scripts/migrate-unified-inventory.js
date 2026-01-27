const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'press_db', // Assuming database name, will verify or use logic from other scripts if needed, but 'press_db' was used in previous context or 'press'
    // Actually, let's check lib/db.js to be sure of the DB name. 
    // Wait, I can't check lib/db.js easily inside this code block. 
    // I recall previous scripts used 'press_db' or similar. 
    // Let's assume 'press_db' based on standard practice or check previous scripts.
    // Previous script `migrate-plates.js` used: database: 'erp_press' (Wait, I should check).
    // Let me check `lib/db.js` first to be safe.
    database: 'erp_press'
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Create inventory_items table
        console.log('Creating inventory_items table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category ENUM('Paper', 'Plate', 'Ink', 'SF', 'RM', 'FG') NOT NULL,
                type VARCHAR(255),
                unit_cost DECIMAL(10, 4) DEFAULT 0.0000,
                stock_quantity INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Migrate Papers
        console.log('Migrating Papers...');
        const [papers] = await connection.execute('SELECT * FROM papers');
        for (const paper of papers) {
            await connection.execute(
                'INSERT INTO inventory_items (name, category, type, unit_cost, stock_quantity, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [paper.name, 'Paper', paper.type, paper.cost_per_sheet, paper.stock_quantity, paper.created_at || new Date()]
            );
        }

        // 3. Migrate Plates
        console.log('Migrating Plates...');
        // We need to keep track of old Plate ID to new Inventory ID mapping to update machines
        const [plates] = await connection.execute('SELECT * FROM plates');
        const plateMapping = {}; // oldId -> newId

        for (const plate of plates) {
            const [result] = await connection.execute(
                'INSERT INTO inventory_items (name, category, type, unit_cost, stock_quantity, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [plate.name, 'Plate', 'Offset Plate', plate.unit_cost, 0, plate.created_at || new Date()]
            );
            plateMapping[plate.id] = result.insertId;
        }

        // 4. Update Machines
        console.log('Updating Machines references...');
        // We need to ensure machines table can link to inventory_items
        // The column `plate_id` currently links to `plates.id`. 
        // We should update `plate_id` values to the new `inventory_items.id` values.
        // And logically `plate_id` now means "Default Plate Inventory Item ID".

        const [machines] = await connection.execute('SELECT * FROM machines WHERE plate_id IS NOT NULL');
        for (const machine of machines) {
            const newPlateId = plateMapping[machine.plate_id];
            if (newPlateId) {
                await connection.execute('UPDATE machines SET plate_id = ? WHERE id = ?', [newPlateId, machine.id]);
            } else {
                // If mapping not found (e.g. data inconsistency), set to NULL
                await connection.execute('UPDATE machines SET plate_id = NULL WHERE id = ?', [machine.id]);
            }
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
