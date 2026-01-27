const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setupDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'erp_press'
        });

        console.log('Connected to database.');

        // Create Users table
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Users table checked/created.');

        // Check if admin user exists
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', ['admin@pressmatics.com']);

        if (rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await connection.execute(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Admin', 'admin@pressmatics.com', hashedPassword, 'admin']
            );
            console.log('Admin user created (admin@pressmatics.com / admin123).');
        } else {
            console.log('Admin user already exists.');
        }

        await connection.end();
        console.log('Database setup complete.');
    } catch (error) {
        console.error('Database setup failed:', error);
    }
}

setupDatabase();
