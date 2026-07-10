/**
 * Migration: Employee Management
 * Creates employees, teams, team_members tables
 * and adds assignment + make-ready columns to machines.
 *
 * Run: node scripts/migrate_employees.js
 */

import pool from '../lib/db.js';

async function migrate() {
    const conn = await pool.getConnection();
    try {
        console.log('🚀 Starting Employee Management migration...\n');

        // ── 1. employees ──────────────────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS employees (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                employee_id      VARCHAR(20)  UNIQUE,
                name             VARCHAR(100) NOT NULL,
                job_title        VARCHAR(100),
                department       VARCHAR(100),
                phone            VARCHAR(30),
                email            VARCHAR(120),
                date_of_birth    DATE,
                date_joined      DATE,
                shift            VARCHAR(20)  DEFAULT 'Day',
                status           VARCHAR(20)  DEFAULT 'active',
                notes            TEXT,
                created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅  Table `employees` ready');

        // ── 2. teams ──────────────────────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS teams (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                name        VARCHAR(100) NOT NULL,
                description TEXT,
                color       VARCHAR(10)  DEFAULT '#6366f1',
                created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅  Table `teams` ready');

        // ── 3. team_members ───────────────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS team_members (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                team_id     INT NOT NULL,
                employee_id INT NOT NULL,
                role        VARCHAR(50)  DEFAULT 'member',
                UNIQUE KEY uq_team_employee (team_id, employee_id),
                CONSTRAINT fk_tm_team     FOREIGN KEY (team_id)     REFERENCES teams(id)     ON DELETE CASCADE,
                CONSTRAINT fk_tm_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅  Table `team_members` ready');

        // ── 4. Alter machines: add new columns (idempotent) ───────────────────
        const [cols] = await conn.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'machines'
        `);
        const existingCols = cols.map(c => c.COLUMN_NAME);

        if (!existingCols.includes('assigned_employee_id')) {
            await conn.execute(`ALTER TABLE machines ADD COLUMN assigned_employee_id INT DEFAULT NULL`);
            console.log('✅  Column `machines.assigned_employee_id` added');
        } else {
            console.log('⏭️  Column `machines.assigned_employee_id` already exists');
        }

        if (!existingCols.includes('assigned_team_id')) {
            await conn.execute(`ALTER TABLE machines ADD COLUMN assigned_team_id INT DEFAULT NULL`);
            console.log('✅  Column `machines.assigned_team_id` added');
        } else {
            console.log('⏭️  Column `machines.assigned_team_id` already exists');
        }

        if (!existingCols.includes('make_ready_minutes')) {
            await conn.execute(`ALTER TABLE machines ADD COLUMN make_ready_minutes INT DEFAULT 0`);
            console.log('✅  Column `machines.make_ready_minutes` added');
        } else {
            console.log('⏭️  Column `machines.make_ready_minutes` already exists');
        }

        console.log('\n🎉 Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
