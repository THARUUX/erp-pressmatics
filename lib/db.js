import mysql from 'mysql2/promise';
import { cookies } from 'next/headers';
import 'dotenv/config';

// Function to create Pool 1 (Company 1 - Primary)
function createPool1() {
  return mysql.createPool({
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
    maxIdle: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // 10 s
    idleTimeout: 30000,
    connectTimeout: 5000,
    dateStrings: ['DATE'],
  });
}

// Function to create Pool 2 (Company 2)
function createPool2() {
  return mysql.createPool({
    host: process.env.DB_HOST_CO2 || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: parseInt(process.env.DB_PORT_CO2 || '4000', 10),
    user: process.env.DB_USERNAME_CO2 || '2Db1nUiVftFh5mM.root',
    password: process.env.DB_PASSWORD_CO2 || 'N8QPZ4x1VFYzaUq9',
    database: process.env.DB_DATABASE_CO2 || 'erp_press',
    timezone: '+00:00',
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // 10 s
    idleTimeout: 30000,
    connectTimeout: 5000,
    dateStrings: ['DATE'],
  });
}

// Use globalThis singleton caching in development to avoid pool proliferation across HMR reloads
let pool1;
let pool2;

if (process.env.NODE_ENV === 'production') {
  pool1 = createPool1();
  pool2 = createPool2();
} else {
  if (!globalThis._mysqlPool1) {
    globalThis._mysqlPool1 = createPool1();
  }
  if (!globalThis._mysqlPool2) {
    globalThis._mysqlPool2 = createPool2();
  }
  pool1 = globalThis._mysqlPool1;
  pool2 = globalThis._mysqlPool2;
}

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
  'ETIMEDOUT',
  'EPIPE',
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
        try {
          return await activePool[prop](sql, params, callback);
        } catch (err) {
          if (RETRYABLE.has(err.code)) {
            console.warn(`[dbProxy] Retrying after ${err.code}…`);
            return await activePool[prop](sql, params, callback);
          }
          throw err;
        }
      };
    }

    if (prop === 'getConnection') {
      return async () => {
        const activePool = await getActivePool();
        return activePool.getConnection();
      };
    }

    const val = pool1[prop];
    if (typeof val === 'function') {
      return val.bind(pool1);
    }
    return val;
  }
});

export { pool1, pool2 };
export default poolProxy;