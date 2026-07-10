const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000', 10),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
};

async function runTest() {
  console.log('🧪 Starting programmatic payroll calculation test...');
  const connection = await mysql.createConnection(dbConfig);

  let testEmployeeId = null;
  let testPayrollRunId = null;

  try {
    // 1. Create a clean test employee
    console.log('Creating mock employee...');
    const [empResult] = await connection.execute(`
      INSERT INTO employees (
        employee_id, name, job_title, department, shift, status, 
        pay_type, base_salary, hourly_rate, allowances, deductions, 
        ot_rate_multiplier, standard_working_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'EMP-TEST-999', 'Test Payroll Emp', 'Senior Automation Engineer', 'Admin', 'Day', 'active',
      'monthly', 176000.00, 0.00, 5000.00, 2000.00, 1.50, 8.00
    ]);
    testEmployeeId = empResult.insertId;
    console.log(`  ✅ Employee created with DB ID: ${testEmployeeId}`);

    // 2. Map the employee to a test device user ID
    const testDeviceUserId = '99999';
    await connection.execute(`
      INSERT INTO employee_zkteco_mapping (employee_id, device_user_id)
      VALUES (?, ?)
    `, [testEmployeeId, testDeviceUserId]);
    console.log(`  ✅ Employee mapped to Device User ID: ${testDeviceUserId}`);

    // 3. Insert mock attendance logs for July 2026
    console.log('Inserting mock attendance logs for July 2026...');
    const mockLogs = [
      // Day 1: 08:00 to 16:00 (8 hours, 0 OT)
      { ts: '2026-07-01 08:00:00', state: 0 },
      { ts: '2026-07-01 16:00:00', state: 1 },
      // Day 2: 08:00 to 18:00 (10 hours, 2 OT)
      { ts: '2026-07-02 08:00:00', state: 0 },
      { ts: '2026-07-02 18:00:00', state: 1 },
      // Day 3: 08:00 to 19:30 (11.5 hours, 3.5 OT)
      { ts: '2026-07-03 08:00:00', state: 0 },
      { ts: '2026-07-03 19:30:00', state: 1 },
      // Day 4: 08:00 to 17:00 (9 hours, 1 OT)
      { ts: '2026-07-04 08:00:00', state: 0 },
      { ts: '2026-07-04 17:00:00', state: 1 }
    ];

    for (const log of mockLogs) {
      await connection.execute(`
        INSERT INTO zkteco_attendance_logs (device_user_id, timestamp, state, verification_type)
        VALUES (?, ?, ?, 1)
      `, [testDeviceUserId, log.ts, log.state]);
    }
    console.log('  ✅ Mock attendance logs inserted.');

    // 4. Run calculation logic (mirroring POST API)
    console.log('Running payroll calculation logic...');
    
    // Fetch logs for the test user in July 2026
    const [logs] = await connection.execute(`
      SELECT timestamp, state FROM zkteco_attendance_logs
      WHERE device_user_id = ? AND timestamp >= '2026-07-01 00:00:00' AND timestamp <= '2026-07-31 23:59:59'
      ORDER BY timestamp ASC
    `, [testDeviceUserId]);

    // Group logs by date
    const logsByDate = {};
    for (const log of logs) {
      const dStr = new Date(log.timestamp).toISOString().split('T')[0];
      if (!logsByDate[dStr]) logsByDate[dStr] = [];
      logsByDate[dStr].push(log);
    }

    let totalHours = 0;
    let totalOTHours = 0;
    const stdHours = 8.00;
    const otMult = 1.50;

    for (const dateStr in logsByDate) {
      const dayLogs = logsByDate[dateStr];
      let dailyHours = 0;
      let lastCheckIn = null;

      for (const log of dayLogs) {
        if (log.state === 0) {
          if (lastCheckIn === null) {
            lastCheckIn = new Date(log.timestamp);
          }
        } else if (log.state === 1) {
          if (lastCheckIn !== null) {
            const diffMs = new Date(log.timestamp).getTime() - lastCheckIn.getTime();
            dailyHours += diffMs / (1000 * 60 * 60);
            lastCheckIn = null;
          }
        }
      }

      let dailyOT = 0;
      if (dailyHours > stdHours) {
        dailyOT = dailyHours - stdHours;
      }
      totalHours += dailyHours;
      totalOTHours += dailyOT;
    }

    console.log(`  Calculated total hours: ${totalHours.toFixed(2)} (Expected: 38.5)`);
    console.log(`  Calculated overtime hours: ${totalOTHours.toFixed(2)} (Expected: 6.5)`);

    // Pay calculations
    const baseSalary = 176000.00;
    const allowances = 5000.00;
    const deductions = 2000.00;
    const otHourlyRate = baseSalary / 176.00; // 1000 LKR
    const otPay = totalOTHours * otHourlyRate * otMult; // 6.5 * 1000 * 1.5 = 9750
    const netPay = (baseSalary + otPay + allowances) - deductions;

    console.log(`  Calculated OT Pay: LKR ${otPay.toFixed(2)} (Expected: 9750.00)`);
    console.log(`  Calculated Net Pay: LKR ${netPay.toFixed(2)} (Expected: 188750.00)`);

    // Assertions
    if (Math.abs(totalHours - 38.5) > 0.01) throw new Error('Assertion failed: totalHours should be 38.5');
    if (Math.abs(totalOTHours - 6.5) > 0.01) throw new Error('Assertion failed: totalOTHours should be 6.5');
    if (Math.abs(otPay - 9750.00) > 0.01) throw new Error('Assertion failed: otPay should be 9750.00');
    if (Math.abs(netPay - 188750.00) > 0.01) throw new Error('Assertion failed: netPay should be 188750.00');
    
    console.log('  🎯 Assertions PASSED successfully.');

    // 5. Save a test payroll run and payslip to DB
    console.log('Writing test payroll run and payslip to database...');
    const [runResult] = await connection.execute(
      'INSERT INTO payroll_runs (year, month, status) VALUES (?, ?, ?)',
      [2026, 7, 'draft']
    );
    testPayrollRunId = runResult.insertId;

    await connection.execute(`
      INSERT INTO payslips (
        payroll_run_id, employee_id, pay_type, base_salary, hourly_rate, 
        total_hours_worked, overtime_hours, overtime_pay, allowances, deductions, net_pay, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testPayrollRunId, testEmployeeId, 'monthly', baseSalary, 0.00,
      totalHours, totalOTHours, otPay, allowances, deductions, netPay, 'draft'
    ]);

    // Query it back to verify database write/read persistence
    const [[payslip]] = await connection.execute(
      'SELECT * FROM payslips WHERE payroll_run_id = ? AND employee_id = ?',
      [testPayrollRunId, testEmployeeId]
    );
    console.log('  ✅ Payslip persisted and read back from database:', {
      net_pay: parseFloat(payslip.net_pay),
      status: payslip.status
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // 6. Cleanup DB (very important to leave the DB clean)
    console.log('🧹 Cleaning up test data from database...');
    if (testPayrollRunId) {
      await connection.execute('DELETE FROM payroll_runs WHERE id = ?', [testPayrollRunId]);
    }
    if (testEmployeeId) {
      await connection.execute('DELETE FROM employees WHERE id = ?', [testEmployeeId]);
    }
    await connection.end();
    console.log('🎉 DB Cleanup finished. Test connection closed.');
  }
}

runTest();
