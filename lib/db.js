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

// Helper to get WhatsApp Daemon URL
export async function getWhatsAppDaemonUrl() {
  return process.env.WHATSAPP_DAEMON_URL || process.env.WHATSAPP_DAEMON_URL_CO1 || 'http://localhost:5001';
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
  try {
    return await pool1.execute(sql, params);
  } catch (err) {
    if (RETRYABLE.has(err.code)) {
      console.warn(`[db] Retrying after ${err.code}…`);
      return await pool1.execute(sql, params);
    }
    throw err;
  }
}

// Javascript Proxy wrapper for the default pool export
const poolProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'execute' || prop === 'query') {
      return async (sql, params, callback) => {
        try {
          return await pool1[prop](sql, params, callback);
        } catch (err) {
          if (RETRYABLE.has(err.code)) {
            console.warn(`[dbProxy] Retrying after ${err.code}…`);
            return await pool1[prop](sql, params, callback);
          }
          throw err;
        }
      };
    }

    if (prop === 'getConnection') {
      return async () => {
        return pool1.getConnection();
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