const mysql = require('mysql2/promise');

async function check_schema() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'erp_press'
    });

    try {
        const [tables] = await pool.execute('SHOW TABLES');
        console.log("Tables:", tables.map(t => Object.values(t)[0]));

        // Check columns for quotation_item_finishings if it exists
        try {
            const [cols] = await pool.execute('DESCRIBE quotation_item_finishings');
            console.log("quotation_item_finishings columns:", cols.map(c => c.Field));
        } catch (e) {
            console.log("quotation_item_finishings table error:", e.message);
        }

        // Check columns for quotation_item_details if it exists
        try {
            const [cols] = await pool.execute('DESCRIBE quotation_item_details');
            console.log("quotation_item_details columns:", cols.map(c => c.Field));
        } catch (e) {
            console.log("quotation_item_details table error:", e.message);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check_schema();
