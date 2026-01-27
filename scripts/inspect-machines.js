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

        const [rows] = await connection.execute("DESCRIBE machines");
        console.table(rows);

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

inspect();
