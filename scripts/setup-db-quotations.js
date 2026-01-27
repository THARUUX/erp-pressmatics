const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press',
};

async function setupQuotationsDB() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Create machines table
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS machines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('offset', 'digital') NOT NULL,
        sheet_factor DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Created machines table.');

        // 2. Create finishings table
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS finishings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        unit_cost DECIMAL(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Created finishings table.');

        // 3. Create quotations table (Header)
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        job_description TEXT,
        type ENUM('offset', 'digital') NOT NULL,
        quantity INT NOT NULL,
        total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Created quotations table.');

        // 4. Create quotation_details table (Snapshots)
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotation_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        machine_id INT,
        
        -- Inputs
        paper_cost_per_sheet DECIMAL(10, 2),
        plate_cost_unit DECIMAL(10, 2),
        impression_cost_unit DECIMAL(10, 2),
        wastage_percent DECIMAL(5, 2),
        ups INT,
        sides INT,
        colors INT,
        
        -- Calculations
        printed_sheets INT,
        full_sheets_used INT,
        wastage_sheets INT,
        total_sheets INT,
        plate_count INT,
        
        -- Final Costs
        final_paper_cost DECIMAL(15, 2),
        final_plate_cost DECIMAL(15, 2),
        final_printing_cost DECIMAL(15, 2),
        final_finishing_cost DECIMAL(15, 2),
        
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      )
    `);
        console.log('Created quotation_details table.');

        // 5. Create quotation_finishings table (Link table)
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotation_finishings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        name VARCHAR(255) NOT NULL, -- Snapshot name in case original finishing is deleted 
        quantity INT NOT NULL,
        unit_cost DECIMAL(10, 2) NOT NULL,
        total_cost DECIMAL(15, 2) NOT NULL,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      )
    `);
        console.log('Created quotation_finishings table.');

        // 6. Seed Machines
        // Clear existing machines to ensure clean state or use INSERT IGNORE
        await connection.execute('DELETE FROM machines');

        // KORD = 1/4 sheet (0.25)
        // SM74 = 1/2 sheet (0.50)
        // SM102 = Full sheet (1.00)
        // Digital A3 = (using 1.00 for now, logic will differ)
        const machines = [
            ['KORD', 'offset', 0.25],
            ['SM74', 'offset', 0.50],
            ['SM102', 'offset', 1.00],
            ['Digital A3', 'digital', 1.00]
        ];

        for (const machine of machines) {
            await connection.execute(
                'INSERT INTO machines (name, type, sheet_factor) VALUES (?, ?, ?)',
                machine
            );
        }
        console.log('Seeded machines data.');

        // 7. Seed Basic Finishings
        await connection.execute('DELETE FROM finishings');
        const finishings = [
            ['Cutting', 0.50],
            ['Lamination (Gloss)', 5.00],
            ['Lamination (Matt)', 6.00],
            ['Binding (Perfect)', 15.00],
            ['Binding (Saddle Stitch)', 5.00],
            ['Spot UV', 3.00],
            ['Die Cutting', 2.00]
        ];

        for (const finishing of finishings) {
            await connection.execute(
                'INSERT INTO finishings (name, unit_cost) VALUES (?, ?)',
                finishing
            );
        }
        console.log('Seeded finishings data.');

    } catch (error) {
        console.error('Error setting up quotations database:', error);
    } finally {
        if (connection) await connection.end();
    }
}

setupQuotationsDB();
