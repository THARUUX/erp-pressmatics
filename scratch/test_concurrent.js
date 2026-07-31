import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'pressmatics_jwt_secret_2024_xk9z';

const dbConfig = {
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

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

async function run() {
    const pool = mysql.createPool(dbConfig);
    try {
        console.log('Fetching active sales orders from DB...');
        const [orders] = await pool.execute('SELECT id, code FROM sales_orders ORDER BY id DESC');
        console.log(`Testing ${orders.length} orders concurrently over HTTP...`);

        const token = signToken({ id: 1, email: 'admin@pressmatics.com', role: 'admin', permissions: { access_sales: 1, access_production: 1 } });

        for (const order of orders) {
            // Concurrent requests like the page load
            const urls = [
                `http://localhost:3000/api/sales-orders/${order.id}`,
                `http://localhost:3000/api/sales-orders/${order.id}/tasks`
            ];
            
            const results = await Promise.all(
                urls.map(url => fetch(url, {
                    headers: {
                        'Cookie': `token=${token}`
                    }
                }))
            );

            results.forEach((res, idx) => {
                if (res.status === 500) {
                    console.error(`FAILED: ${urls[idx]} - Status 500`);
                }
            });
        }
        console.log('Done scanning all orders concurrently.');
    } catch (e) {
        console.error('Error running test:', e);
    } finally {
        await pool.end();
    }
}

run();
