const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press',
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Add columns to quotation_item_finishings
        // machine_id, is_machine, time_per_unit, total_time
        const queries = [
            `ALTER TABLE quotation_item_finishings ADD COLUMN machine_id INT NULL`,
            `ALTER TABLE quotation_item_finishings ADD COLUMN is_machine BOOLEAN DEFAULT FALSE`,
            `ALTER TABLE quotation_item_finishings ADD COLUMN time_per_unit INT DEFAULT 0 COMMENT 'Seconds per unit'`,
            `ALTER TABLE quotation_item_finishings ADD COLUMN total_time INT DEFAULT 0 COMMENT 'Total seconds'`,
            `ALTER TABLE quotation_item_finishings ADD CONSTRAINT fk_qif_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL`
        ];

        for (const query of queries) {
            try {
                await connection.execute(query);
                console.log(`Executed: ${query}`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Skipping (Duplicate Column): ${query}`);
                } else if (error.code === 'ER_DUP_KEYNAME') {
                    console.log(`Skipping (Duplicate Key): ${query}`);
                } else {
                    console.error(`Error executing: ${query}`, error);
                }
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
