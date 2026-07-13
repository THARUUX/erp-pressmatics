import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Keep connections alive so the DB server doesn't silently drop them
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 s
  // Drop idle connections after 60 s so the pool never holds stale ones
  idleTimeout: 60000,
});

// Stale-connection error codes that warrant a single automatic retry
const RETRYABLE = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
  'ER_CON_COUNT_ERROR',
]);

/**
 * Execute a query with one automatic retry on stale-connection errors.
 * Drop-in replacement for pool.execute / pool.query.
 *
 * Usage (same as pool.execute):
 *   const [rows] = await dbQuery('SELECT 1');
 *   const [rows] = await dbQuery('SELECT * FROM t WHERE id = ?', [id]);
 */
export async function dbQuery(sql, params = []) {
  try {
    return await pool.execute(sql, params);
  } catch (err) {
    if (RETRYABLE.has(err.code)) {
      console.warn(`[db] Retrying after ${err.code}…`);
      return await pool.execute(sql, params);
    }
    throw err;
  }
}

export default pool;