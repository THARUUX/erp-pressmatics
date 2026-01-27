const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_press'
};

async function inspect() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        console.log('--- finishings ---');
        const [finishings] = await connection.execute("DESCRIBE finishings");
        console.table(finishings);

        console.log('--- inventory_items ---');
        const [inventory] = await connection.execute("DESCRIBE inventory_items");
        console.table(inventory);

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

inspect();
