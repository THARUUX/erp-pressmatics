const mysql = require('../node_modules/mysql2/promise');
const fs = require('fs');
const dotenv = require('../node_modules/dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));

async function main() {
    const conn = await mysql.createConnection({
        host: envConfig.DB_HOST,
        port: parseInt(envConfig.DB_PORT || '4000', 10),
        user: envConfig.DB_USERNAME,
        password: envConfig.DB_PASSWORD,
        database: envConfig.DB_DATABASE,
        ssl: {
            rejectUnauthorized: false
        }
    });
    const [rows] = await conn.execute("SELECT id, sales_order_id, name, description, is_manual FROM job_tasks WHERE name LIKE '%Manual Standalone%'");
    console.log('Matches:', rows);
    await conn.end();
}
main().catch(console.error);
