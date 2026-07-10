import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ZKLib from 'node-zklib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.FINGERPRINT_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database pool configuration
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  dateStrings: true,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// ZKTeco config
const DEVICE_IP = process.env.ZKTECO_IP || '192.168.1.201';
const DEVICE_PORT = parseInt(process.env.ZKTECO_PORT || '4370', 10);
const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let isSyncing = false;
let lastSyncStatus = {
  success: true,
  time: null,
  message: 'Server started. No sync performed yet.',
  logsFetched: 0,
  logsInserted: 0,
};

// Test ZKTeco connection helper
async function checkDeviceConnection() {
  const zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 3000, 4000);
  try {
    await zkInstance.createSocket();
    await zkInstance.disconnect();
    return true;
  } catch (err) {
    return false;
  }
}

// Actual Sync Logic
async function syncLogs(simulate = false) {
  if (isSyncing) {
    return { success: false, message: 'Sync already in progress' };
  }

  isSyncing = true;
  console.log(`[${new Date().toISOString()}] Starting ZKTeco Sync (Simulate: ${simulate})...`);
  
  let zkInstance = null;
  let connection = null;

  try {
    connection = await pool.getConnection();
    let logs = [];
    let users = [];

    if (simulate) {
      // Generate some dummy logs for simulation
      const [empRows] = await connection.execute('SELECT id, name FROM employees LIMIT 10');
      const [mappedRows] = await connection.execute('SELECT device_user_id, employee_id FROM employee_zkteco_mapping');
      
      const mappedUserIds = mappedRows.map(r => r.device_user_id);
      
      // Ensure we have some device user ids to simulate if mapping is empty
      const sampleIds = mappedUserIds.length > 0 ? mappedUserIds : ['101', '102', '103', '104'];
      
      const now = new Date();
      for (let i = 0; i < 15; i++) {
        const randomUser = sampleIds[Math.floor(Math.random() * sampleIds.length)];
        const randomMinutes = Math.floor(Math.random() * 480); // Up to 8 hours ago
        const logTime = new Date(now.getTime() - randomMinutes * 60 * 1000);
        
        logs.push({
          deviceUserId: randomUser,
          timestamp: logTime.toISOString().replace('T', ' ').substring(0, 19),
          state: Math.random() > 0.5 ? 1 : 0, // 0 = Check In, 1 = Check Out
          verificationType: 1, // Fingerprint
        });
      }
      
      users = [
        { userId: '101', name: 'Simulated User 1' },
        { userId: '102', name: 'Simulated User 2' },
        { userId: '103', name: 'Simulated User 3' },
        { userId: '104', name: 'Simulated User 4' },
      ];
    } else {
      zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 4000);
      await zkInstance.createSocket();
      
      try {
        const usersRes = await zkInstance.getUsers();
        users = (usersRes && Array.isArray(usersRes.data)) ? usersRes.data : [];
      } catch (err) {
        console.warn('Failed to fetch users from device, continuing to logs...', err.message);
      }
      
      const attLogs = await zkInstance.getAttendances();
      const attLogsArray = (attLogs && Array.isArray(attLogs.data)) ? attLogs.data : [];
      console.log('Raw logs fetched from machine:', attLogsArray.length, 'records');
      logs = attLogsArray.map(l => {
        const timeVal = l.recordTime || l.timestamp;
        const parsedTime = timeVal ? new Date(timeVal) : new Date();
        
        let formattedTime;
        if (!isNaN(parsedTime.getTime())) {
          const pad = (num) => String(num).padStart(2, '0');
          formattedTime = `${parsedTime.getFullYear()}-${pad(parsedTime.getMonth() + 1)}-${pad(parsedTime.getDate())} ${pad(parsedTime.getHours())}:${pad(parsedTime.getMinutes())}:${pad(parsedTime.getSeconds())}`;
        } else {
          const now = new Date();
          const pad = (num) => String(num).padStart(2, '0');
          formattedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        }

        return {
          deviceUserId: l.deviceUserId,
          timestamp: formattedTime,
          state: l.state !== undefined ? l.state : 0,
          verificationType: l.verifyMode !== undefined ? l.verifyMode : (l.verificationType !== undefined ? l.verificationType : 1)
        };
      });
      console.log('Fetched logs:', JSON.stringify(logs, null, 2));
    }

    console.log(`Fetched ${logs.length} logs from ${simulate ? 'Simulation' : 'ZKTeco device'}.`);

    // Get maximum timestamp already in DB to optimize sync and reduce DB load
    let maxTimeStr = null;
    try {
      const [[{ max_time }]] = await connection.execute('SELECT MAX(timestamp) as max_time FROM zkteco_attendance_logs');
      maxTimeStr = max_time;
    } catch (dbErr) {
      console.warn('Failed to fetch max timestamp from DB:', dbErr.message);
    }

    let newLogs = logs;
    if (maxTimeStr) {
      // Filter out older records using lexicographical string comparison
      newLogs = logs.filter(log => log.timestamp >= maxTimeStr);
    }

    console.log(`Checking ${newLogs.length} potentially new logs out of ${logs.length} total logs.`);

    // Insert into database
    let insertedCount = 0;
    if (newLogs.length > 0) {
      for (const log of newLogs) {
        try {
          const [result] = await connection.execute(
            `INSERT IGNORE INTO zkteco_attendance_logs 
             (device_user_id, timestamp, state, verification_type) 
             VALUES (?, ?, ?, ?)`,
            [log.deviceUserId, log.timestamp, log.state, log.verificationType]
          );
          if (result.affectedRows > 0) {
            insertedCount++;
          }
        } catch (dbErr) {
          console.error('Error inserting log:', dbErr.message);
        }
      }
    } else {
      console.log('No new logs to insert.');
    }

    lastSyncStatus = {
      success: true,
      time: new Date(),
      message: `Sync successful! Fetched ${logs.length} logs, added ${insertedCount} new records.`,
      logsFetched: logs.length,
      logsInserted: insertedCount,
    };

    console.log(`Sync complete. Inserted ${insertedCount} new records.`);
    return lastSyncStatus;
  } catch (err) {
    console.error('Sync failed:', err);
    lastSyncStatus = {
      success: false,
      time: new Date(),
      message: `Sync failed: ${err.message}`,
      logsFetched: 0,
      logsInserted: 0,
    };
    return lastSyncStatus;
  } finally {
    if (zkInstance) {
      try {
        await zkInstance.disconnect();
      } catch (disErr) {
        console.error('Error disconnecting ZKTeco:', disErr);
      }
    }
    if (connection) {
      connection.release();
    }
    isSyncing = false;
  }
}

// ── API ROUTES ────────────────────────────────────────────────────────────────

// 1. Status Check
app.get('/api/status', async (req, res) => {
  const isOnline = await checkDeviceConnection();
  
  // Get database stats
  let totalLogs = 0;
  let totalMapped = 0;
  let totalUnmapped = 0;
  let lastDbUpload = null;

  try {
    const [[{ count: logsCount }]] = await pool.execute('SELECT COUNT(*) as count FROM zkteco_attendance_logs');
    const [[{ count: mappedCount }]] = await pool.execute('SELECT COUNT(*) as count FROM employee_zkteco_mapping');
    const [[{ count: unmappedCount }]] = await pool.execute(`
      SELECT COUNT(DISTINCT l.device_user_id) as count 
      FROM zkteco_attendance_logs l 
      LEFT JOIN employee_zkteco_mapping m ON l.device_user_id = m.device_user_id 
      WHERE m.employee_id IS NULL
    `);
    const [[{ last_uploaded }]] = await pool.execute('SELECT MAX(created_at) as last_uploaded FROM zkteco_attendance_logs');
    
    totalLogs = logsCount;
    totalMapped = mappedCount;
    totalUnmapped = unmappedCount;
    lastDbUpload = last_uploaded;
  } catch (dbErr) {
    console.error('Error fetching dashboard stats:', dbErr);
  }

  res.json({
    device: {
      ip: DEVICE_IP,
      port: DEVICE_PORT,
      online: isOnline,
    },
    sync: {
      isSyncing,
      ...lastSyncStatus,
    },
    stats: {
      totalLogs,
      totalMapped,
      totalUnmapped,
      lastDbUpload,
    }
  });
});

// 2. Trigger Sync
app.post('/api/sync', async (req, res) => {
  const { simulate } = req.body;
  
  // If not simulating, check if connection succeeds
  if (!simulate) {
    const isOnline = await checkDeviceConnection();
    if (!isOnline) {
      return res.status(503).json({ 
        error: 'ZKTeco device is offline. Cannot sync. Try simulation mode if testing.' 
      });
    }
  }

  const result = await syncLogs(!!simulate);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json({ error: result.message });
  }
});

// 3. Get Mapping List
app.get('/api/mapping', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT e.id as employee_id, e.name, e.employee_id as erp_code, e.department, e.job_title,
             m.device_user_id, m.created_at as mapped_at
      FROM employees e
      LEFT JOIN employee_zkteco_mapping m ON e.id = m.employee_id
      ORDER BY e.name ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch mappings:', err);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// 4. Update/Set Mapping
app.post('/api/mapping', async (req, res) => {
  const { employee_id, device_user_id } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  try {
    if (!device_user_id || device_user_id.trim() === '') {
      // Delete mapping
      await pool.execute(
        'DELETE FROM employee_zkteco_mapping WHERE employee_id = ?',
        [employee_id]
      );
      return res.json({ success: true, message: 'Mapping removed' });
    }

    // Insert or update mapping
    await pool.execute(
      `INSERT INTO employee_zkteco_mapping (device_user_id, employee_id) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE employee_id = ?`,
      [device_user_id.trim(), employee_id, employee_id]
    );

    res.json({ success: true, message: 'Mapping updated successfully' });
  } catch (err) {
    console.error('Failed to save mapping:', err);
    res.status(500).json({ error: 'Failed to save mapping: ' + err.message });
  }
});

// 5. Get Users registered on the Biometric Device
app.get('/api/device-users', async (req, res) => {
  const isOnline = await checkDeviceConnection();
  
  if (!isOnline) {
    return res.json([
      { userId: '101', name: 'Device User 101', cardno: 98765, role: 0 },
      { userId: '102', name: 'Device User 102', cardno: 0, role: 0 },
      { userId: '103', name: 'Device User 103', cardno: 54321, role: 14 },
      { userId: '104', name: 'Device User 104', cardno: 0, role: 0 },
    ]);
  }

  let zkInstance = null;
  try {
    zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 4000);
    await zkInstance.createSocket();
    
    const usersRes = await zkInstance.getUsers();
    const users = (usersRes && Array.isArray(usersRes.data)) ? usersRes.data : [];
    res.json(users);
  } catch (err) {
    console.error('Failed to fetch device users:', err);
    res.status(500).json({ error: 'Failed to fetch device users: ' + err.message });
  } finally {
    if (zkInstance) {
      try { await zkInstance.disconnect(); } catch (e) {}
    }
  }
});


// 5. Unmapped Log User IDs
app.get('/api/unmapped-logs', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT l.device_user_id, COUNT(*) as log_count, MAX(l.timestamp) as last_seen
      FROM zkteco_attendance_logs l
      LEFT JOIN employee_zkteco_mapping m ON l.device_user_id = m.device_user_id
      WHERE m.employee_id IS NULL
      GROUP BY l.device_user_id
      ORDER BY last_seen DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch unmapped user IDs:', err);
    res.status(500).json({ error: 'Failed to fetch unmapped user IDs' });
  }
});

// 6. Get Attendance Logs (Paginated + Filtered)
app.get('/api/logs', async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const search = urlObj.searchParams.get('search') || '';
  const startDate = urlObj.searchParams.get('startDate') || '';
  const endDate = urlObj.searchParams.get('endDate') || '';
  const state = urlObj.searchParams.get('state') || ''; // 0, 1, or empty
  const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
  const limit = parseInt(urlObj.searchParams.get('limit') || '20', 10);
  const offset = (page - 1) * limit;

  let queryParams = [];
  let countParams = [];
  let whereClauses = [];

  if (search) {
    whereClauses.push('(e.name LIKE ? OR e.employee_id LIKE ? OR l.device_user_id LIKE ?)');
    const searchVal = `%${search}%`;
    queryParams.push(searchVal, searchVal, searchVal);
    countParams.push(searchVal, searchVal, searchVal);
  }

  if (startDate) {
    whereClauses.push('l.timestamp >= ?');
    queryParams.push(startDate + ' 00:00:00');
    countParams.push(startDate + ' 00:00:00');
  }

  if (endDate) {
    whereClauses.push('l.timestamp <= ?');
    queryParams.push(endDate + ' 23:59:59');
    countParams.push(endDate + ' 23:59:59');
  }

  if (state !== '') {
    whereClauses.push('l.state = ?');
    queryParams.push(parseInt(state, 10));
    countParams.push(parseInt(state, 10));
  }

  const whereClauseStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  try {
    // Get total logs matching filters
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM zkteco_attendance_logs l
      LEFT JOIN employee_zkteco_mapping m ON l.device_user_id = m.device_user_id
      LEFT JOIN employees e ON m.employee_id = e.id
      ${whereClauseStr}
    `;
    const [[{ count }]] = await pool.execute(countQuery, countParams);

    // Get paginated logs matching filters
    const logsQuery = `
      SELECT l.id, l.device_user_id, l.timestamp, l.state, l.verification_type,
             e.name as employee_name, e.employee_id as erp_code, e.department, e.job_title
      FROM zkteco_attendance_logs l
      LEFT JOIN employee_zkteco_mapping m ON l.device_user_id = m.device_user_id
      LEFT JOIN employees e ON m.employee_id = e.id
      ${whereClauseStr}
      ORDER BY l.timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const [rows] = await pool.execute(logsQuery, queryParams);

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error('Failed to fetch attendance logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Start background cron job/interval sync (only if not simulating, but will log failure gracefully)
setInterval(() => {
  // Try to sync logs from device automatically in the background
  checkDeviceConnection().then(online => {
    if (online) {
      syncLogs(false).catch(err => console.error('Auto sync failed:', err));
    } else {
      console.log('[Auto Sync] ZKTeco machine is offline. Skipping background sync.');
    }
  });
}, SYNC_INTERVAL_MS);

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 ZKTeco Fingerprint Integration Server is running on port ${PORT}`);
  console.log(`👉 Web Interface: http://localhost:${PORT}`);
  console.log(`📡 Connecting to Device: ${DEVICE_IP}:${DEVICE_PORT}`);
  console.log(`=============================================================`);
});

// Global crash protection for network/biometric socket library quirks
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception Alert] Caught global error:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection Alert] Rejection details:', reason);
});

