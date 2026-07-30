import mysql from 'mysql2/promise';
import { cookies } from 'next/headers';
import 'dotenv/config';

// Connection Pool 1 (Company 1 - Primary)
const pool1 = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: '+00:00',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 s
  idleTimeout: 60000,
  dateStrings: ['DATE'],
});

// Connection Pool 2 (Company 2)
const pool2 = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2Db1nUiVftFh5mM.root',
  password: 'N8QPZ4x1VFYzaUq9',
  database: 'erp_press',
  timezone: '+00:00',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 s
  idleTimeout: 60000,
  dateStrings: ['DATE'],
});

// Helper to determine the active pool based on query context and request cookies
async function getActivePool(sql) {
  // Always route shared users table to Company 1
  if (sql && typeof sql === 'string') {
    const isShared = /\b(users)\b/i.test(sql);
    if (isShared) {
      return pool1;
    }
  }

  try {
    const cookieStore = await cookies();
    const companyCookie = cookieStore.get('company_id');
    if (companyCookie && companyCookie.value === '2') {
      return pool2;
    }
  } catch (e) {
    // cookies() throws outside of HTTP request context (e.g., build phase or background tasks)
  }
  return pool1;
}

// Helper to get the correct WhatsApp Daemon URL dynamically based on active company
export async function getWhatsAppDaemonUrl() {
  try {
    const cookieStore = await cookies();
    const companyCookie = cookieStore.get('company_id');
    if (companyCookie && companyCookie.value === '2') {
      return process.env.WHATSAPP_DAEMON_URL_CO2 || 'http://localhost:5002';
    }
  } catch (e) {
    // Fallback if called outside request context
  }
  return process.env.WHATSAPP_DAEMON_URL_CO1 || process.env.WHATSAPP_DAEMON_URL || 'http://localhost:5001';
}

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
 */
export async function dbQuery(sql, params = []) {
  const activePool = await getActivePool(sql);
  try {
    return await activePool.execute(sql, params);
  } catch (err) {
    if (RETRYABLE.has(err.code)) {
      console.warn(`[db] Retrying after ${err.code}…`);
      return await activePool.execute(sql, params);
    }
    throw err;
  }
}

// Javascript Proxy wrapper for the default pool export to dynamically route calls at runtime
const poolProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'execute' || prop === 'query') {
      return async (sql, params, callback) => {
        const activePool = await getActivePool(sql);
        return activePool[prop](sql, params, callback);
      };
    }

    if (prop === 'getConnection') {
      return async () => {
        const activePool = await getActivePool();
        return activePool.getConnection();
      };
    }

    // Default synchronous fallback for static/non-query properties
    // Note: Since cookies() is async, dynamic routing defaults to pool1 for synchronous properties (e.g. pool.on)
    const activePool = pool1;
    const val = activePool[prop];
    if (typeof val === 'function') {
      return val.bind(activePool);
    }
    return val;
  }
});

export { pool1, pool2 };
export default poolProxy;