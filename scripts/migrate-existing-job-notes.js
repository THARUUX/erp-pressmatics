const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const dbConfig1 = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
        }
    };

    const dbConfig2 = {
        host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '2Db1nUiVftFh5mM.root',
        password: 'N8QPZ4x1VFYzaUq9',
        database: 'erp_press',
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
        }
    };

    const configs = [dbConfig1, dbConfig2];

    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        if (!config.host) {
            console.log(`Config ${i+1} has no host, skipping...`);
            continue;
        }

        try {
            console.log(`Connecting to DB ${i+1} (${config.database} on ${config.host})...`);
            const conn = await mysql.createConnection(config);
            
            // Ensure job_notes column exists
            try {
                await conn.query(`
                    ALTER TABLE sales_orders
                    ADD COLUMN job_notes TEXT AFTER auto_deduct_stock;
                `);
                console.log(`DB ${i+1}: Added job_notes column to sales_orders.`);
            } catch (e) {
                if (e.code !== 'ER_DUP_FIELDNAME' && !e.message.includes('Duplicate column name')) {
                    throw e;
                }
                console.log(`DB ${i+1}: job_notes column already exists.`);
            }

            const query = `
                UPDATE sales_orders so
                SET so.job_notes = (
                    SELECT GROUP_CONCAT(qi.job_description SEPARATOR ' / ')
                    FROM quotation_line_items qli
                    JOIN quotation_items qi ON qli.quotation_item_id = qi.id
                    WHERE qli.quotation_id = so.quotation_id
                )
                WHERE so.job_notes IS NULL OR TRIM(so.job_notes) = '' OR TRIM(so.job_notes) = 'undefined'
            `;
            const [result] = await conn.execute(query);
            console.log(`DB ${i+1}: Updated ${result.affectedRows} sales orders with quotation items descriptions.`);
            
            await conn.end();
        } catch (err) {
            console.error(`Error migrating DB ${i+1}:`, err);
        }
    }
}

migrate();
