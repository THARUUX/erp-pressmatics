import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'pressmatics_jwt_secret_2024_xk9z';

const token = jwt.sign({
    id: 1,
    role: 'admin',
    name: 'Test Admin',
    email: 'admin@example.com',
    permissions: {
        access_system: true,
        access_hr: true,
        access_inventory: true,
        access_sales: true,
        access_production: true,
        access_dashboard: true
    }
}, JWT_SECRET, { expiresIn: '1d' });

async function main() {
    // Connect directly to pool2
    const pool2 = mysql.createPool({
        host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '2Db1nUiVftFh5mM.root',
        password: 'N8QPZ4x1VFYzaUq9',
        database: 'erp_press',
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true,
        },
    });

    try {
        console.log('Fetching active sales orders from DB (Company 2)...');
        const [orders] = await pool2.execute('SELECT id, code FROM sales_orders ORDER BY id DESC');
        console.log(`Testing ${orders.length} Company 2 orders over HTTP...`);

        let errorsCount = 0;
        for (const order of orders) {
            const res = await fetch(`http://localhost:3000/api/sales-orders/${order.id}/tasks`, {
                headers: {
                    'Cookie': `token=${token}; company_id=2`
                }
            });
            if (res.status === 500) {
                errorsCount++;
                const text = await res.text();
                console.error(`FAILED for Order ID: ${order.id} (Code: ${order.code}) - Status: 500`);
                console.error(`Response: ${text.slice(0, 500)}`);
            } else if (!res.ok) {
                console.warn(`Non-ok response for Order ID: ${order.id} (Code: ${order.code}) - Status: ${res.status}`);
            }
        }
        console.log(`\nScan complete. Found ${errorsCount} Company 2 orders returning 500.`);
    } catch (e) {
        console.error('Error during run:', e);
    } finally {
        await pool2.end();
    }
}

main();
