const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000', 10),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        waitForConnections: true, connectionLimit: 3, queueLimit: 0
    });

    try {
        // Find customer
        const [[customer]] = await pool.execute(
            `SELECT id, name FROM customers WHERE portal_token = ?`,
            ['2de7aef9464b6d8a2c3db3eb27899bb6c97dcad656d715140092c48118c1ef09']
        );

        if (!customer) {
            console.error('Customer not found with this token');
            process.exit(1);
        }

        const customerId = customer.id;
        console.log(`Found customer: ${customer.name} (ID: ${customerId})`);

        // Clear existing points transactions for a clean demo
        await pool.execute(`DELETE FROM customer_points_transactions WHERE customer_id = ?`, [customerId]);

        // Insert sample earn transactions
        const transactions = [
            { points: 1500, type: 'earn', reference_id: 'INV-1002', description: 'Points earned from invoice payment' },
            { points: 800, type: 'earn', reference_id: 'INV-1021', description: 'Points earned from invoice payment' },
            { points: -500, type: 'redeem', reference_id: 'VOUCHER-50', description: 'Redeemed 5% discount voucher' },
            { points: 250, type: 'earn', reference_id: 'INV-1055', description: 'Points earned from invoice payment' }
        ];

        let totalPoints = 0;
        for (const t of transactions) {
            await pool.execute(
                `INSERT INTO customer_points_transactions (customer_id, points, type, reference_id, description) VALUES (?, ?, ?, ?, ?)`,
                [customerId, t.points, t.type, t.reference_id, t.description]
            );
            totalPoints += t.points;
        }

        // Update customer points balance
        await pool.execute(`UPDATE customers SET points = ? WHERE id = ?`, [totalPoints, customerId]);
        console.log(`Successfully seeded ${transactions.length} point transactions. Total balance: ${totalPoints}`);

        process.exit(0);
    } catch (err) {
        console.error('Failed:', err);
        process.exit(1);
    }
}

run();
