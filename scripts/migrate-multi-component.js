const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press',
    multipleStatements: true
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database.');

    try {
        // 1. Add component_name to quotation_item_details
        console.log('Adding component_name to quotation_item_details...');
        try {
            await connection.query(`
                ALTER TABLE quotation_item_details 
                ADD COLUMN component_name VARCHAR(255) DEFAULT 'Main' AFTER quotation_item_id;
            `);
            console.log('✓ Added component_name column.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠ component_name column already exists.');
            } else {
                throw err;
            }
        }

        // 2. Add quotation_item_detail_id to quotation_item_finishings
        console.log('Adding quotation_item_detail_id to quotation_item_finishings...');
        try {
            await connection.query(`
                ALTER TABLE quotation_item_finishings 
                ADD COLUMN quotation_item_detail_id INT NULL AFTER quotation_item_id,
                ADD CONSTRAINT fk_finishing_detail 
                FOREIGN KEY (quotation_item_detail_id) REFERENCES quotation_item_details(id) ON DELETE CASCADE;
            `);
            console.log('✓ Added quotation_item_detail_id column and foreign key.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠ quotation_item_detail_id column already exists.');
            } else {
                throw err;
            }
        }

        // 3. Migrate existing data: Link finishings to their parent item's detail
        console.log('Migrating existing finishings to link to details...');
        // Logic: For every finishing that has null detail_id, find the detail_id where quotation_item_id matches.
        // Since historically 1 item = 1 detail, we can just join.
        await connection.query(`
            UPDATE quotation_item_finishings f
            JOIN quotation_item_details d ON f.quotation_item_id = d.quotation_item_id
            SET f.quotation_item_detail_id = d.id
            WHERE f.quotation_item_detail_id IS NULL;
        `);
        console.log('✓ Data migration complete.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
        console.log('Connection closed.');
    }
}

migrate();
