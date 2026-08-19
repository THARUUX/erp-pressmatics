import pool from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * Resolves authenticated user from token cookie or request authorization header
 */
export async function getAuthUser(req = null) {
    try {
        let token = null;

        if (req && req.headers) {
            const authHeader = req.headers.get('authorization') || '';
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            try {
                const cookieStore = await cookies();
                token = cookieStore.get('token')?.value;
            } catch (e) {
                // cookies() call might fail if outside server context
            }
        }

        if (!token) return null;

        const decoded = verifyToken(token);
        if (!decoded || !decoded.id) return null;

        const [rows] = await pool.execute(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [decoded.id]
        );

        return rows[0] || null;
    } catch (err) {
        console.error('getAuthUser error:', err.message);
        return null;
    }
}

let tableCreated = false;

async function ensureTable() {
    if (tableCreated) return;
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                username VARCHAR(255) NOT NULL,
                action VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(255) NULL,
                details TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        tableCreated = true;
    } catch (e) {
        console.error('ensureTable activity_logs error:', e.message);
    }
}

/**
 * Non-blocking logger function to record user activity in activity_logs table
 */
export async function logActivity({ user = null, req = null, action, entity_type, entity_id = null, details = null }) {
    try {
        await ensureTable();

        let activeUser = user;
        if (!activeUser) {
            activeUser = await getAuthUser(req);
        }

        const username = activeUser?.name || activeUser?.email || 'System';
        const userId = activeUser?.id || null;
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || null);

        await pool.execute(
            `INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, username, String(action), String(entity_type), entity_id ? String(entity_id) : null, detailsStr]
        );
    } catch (err) {
        // Log quietly so main API flow is never interrupted
        console.error('logActivity error:', err.message);
    }
}
