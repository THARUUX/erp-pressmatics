/**
 * Run this once to create the users table and seed an admin user.
 * Usage: node scripts/setup-users.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL    = 'admin@pressmatics.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME     = 'Administrator';

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '4000'),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });

    console.log('Connected to DB ✓');

    // 1. Create users table
    await conn.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            name       VARCHAR(100)  NOT NULL,
            email      VARCHAR(150)  NOT NULL UNIQUE,
            password   VARCHAR(255)  NOT NULL,
            role       ENUM('admin','user') NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('users table ready ✓');

    // 2. Check if admin already exists
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
    if (existing.length > 0) {
        console.log(`Admin user already exists (${ADMIN_EMAIL}) — skipping seed.`);
    } else {
        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await conn.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [ADMIN_NAME, ADMIN_EMAIL, hashed, 'admin']
        );
        console.log(`Admin user created ✓`);
        console.log(`  Email:    ${ADMIN_EMAIL}`);
        console.log(`  Password: ${ADMIN_PASSWORD}`);
        console.log('  ⚠️  Change this password after first login!');
    }

    await conn.end();
    console.log('Done.');
}

run().catch(e => {
    console.error('Setup failed:', e.message);
    process.exit(1);
});
