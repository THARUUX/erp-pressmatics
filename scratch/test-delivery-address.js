import mysql from 'mysql2/promise';
import 'dotenv/config';

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

async function main() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        console.log('Fetching first delivery item...');
        const [rows] = await conn.execute('SELECT id, customer_name, delivery_address FROM deliveries LIMIT 1');
        if (rows.length === 0) {
            console.log('No deliveries in the queue to test with.');
            return;
        }

        const delivery = rows[0];
        console.log(`Found delivery ID ${delivery.id} for Customer: ${delivery.customer_name}`);
        console.log(`Current address: "${delivery.delivery_address}"`);

        const testAddress = `Test Delivery Address, Floor ${Math.floor(Math.random() * 10) + 1}, Pressmatics Building`;
        console.log(`Updating address to: "${testAddress}"`);

        await conn.execute('UPDATE deliveries SET delivery_address = ? WHERE id = ?', [testAddress, delivery.id]);

        const [rowsAfter] = await conn.execute('SELECT id, delivery_address FROM deliveries WHERE id = ?', [delivery.id]);
        console.log(`After update address in DB: "${rowsAfter[0].delivery_address}"`);

        if (rowsAfter[0].delivery_address === testAddress) {
            console.log('SUCCESS: Delivery address verified and successfully updated in DB.');
        } else {
            console.error('ERROR: Mismatch in saved address.');
        }

        // Restore address to original value
        await conn.execute('UPDATE deliveries SET delivery_address = ? WHERE id = ?', [delivery.delivery_address, delivery.id]);
        console.log('Original address restored.');
    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}
main();
