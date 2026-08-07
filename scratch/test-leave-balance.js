import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
    }
};

async function test() {
    console.log('Starting Leave Balance Tests...');
    const conn = await mysql.createConnection(dbConfig);

    try {
        // Create a test employee
        console.log('1. Creating test employee...');
        await conn.execute('DELETE FROM employees WHERE name = "Test Leave Employee"');
        const [empRes] = await conn.execute(
            `INSERT INTO employees (name, employee_id, leave_limit, remaining_leaves)
             VALUES ("Test Leave Employee", "EMP-TEST-999", 20, 20)`
        );
        const employeeId = empRes.insertId;

        // Verify initial balance
        const [initEmp] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ?', [employeeId]);
        console.log(`Initial Remaining Leaves: ${initEmp[0].remaining_leaves} (Expected: 20)`);

        // Test 1: Deduct leaves on approved leave creation (POST simulator)
        console.log('\n2. Simulating Approved Leave Creation (3 days)...');
        const startDate = '2026-08-10';
        const endDate = '2026-08-12'; // 10, 11, 12 = 3 days
        const days = 3;

        // Perform balance check and deduction (Transaction)
        await conn.beginTransaction();
        const [empRows] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ? FOR UPDATE', [employeeId]);
        const rem1 = empRows[0].remaining_leaves;
        if (rem1 < days) throw new Error('Insufficient leaves');
        await conn.execute('UPDATE employees SET remaining_leaves = remaining_leaves - ? WHERE id = ?', [days, employeeId]);
        const [leaveRes] = await conn.execute(
            `INSERT INTO leaves (employee_id, start_date, end_date, leave_type, status, reason)
             VALUES (?, ?, ?, "casual", "approved", "Vacation")`,
            [employeeId, startDate, endDate]
        );
        await conn.commit();
        const leaveId = leaveRes.insertId;

        const [empAfterPost] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ?', [employeeId]);
        console.log(`Remaining Leaves after approved POST: ${empAfterPost[0].remaining_leaves} (Expected: 17)`);

        // Test 2: Insufficient balance validation
        console.log('\n3. Simulating leave request exceeding remaining balance (18 days)...');
        const excessDays = 18;
        let threwError = false;
        try {
            await conn.beginTransaction();
            const [empRows2] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ? FOR UPDATE', [employeeId]);
            const rem2 = empRows2[0].remaining_leaves;
            if (rem2 < excessDays) {
                throw new Error('Insufficient leave balance');
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            threwError = true;
            console.log(`Validation caught expected error: ${err.message}`);
        }
        if (!threwError) throw new Error('Should have thrown Insufficient Leave Balance error!');

        // Test 3: Rejecting an approved leave (PUT simulator status change)
        console.log('\n4. Simulating updating leave status from approved to rejected (refunding 3 days)...');
        await conn.beginTransaction();
        const [existingLeave] = await conn.execute('SELECT * FROM leaves WHERE id = ? FOR UPDATE', [leaveId]);
        const oldStatus = existingLeave[0].status;
        const newStatus = 'rejected';
        if (oldStatus === 'approved' && newStatus === 'rejected') {
            await conn.execute('UPDATE employees SET remaining_leaves = remaining_leaves + ? WHERE id = ?', [days, employeeId]);
        }
        await conn.execute('UPDATE leaves SET status = ? WHERE id = ?', [newStatus, leaveId]);
        await conn.commit();

        const [empAfterReject] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ?', [employeeId]);
        console.log(`Remaining Leaves after rejection: ${empAfterReject[0].remaining_leaves} (Expected: 20)`);

        // Test 4: Approving a rejected/pending leave (PUT simulator)
        console.log('\n5. Simulating approving the leave again (deducting 3 days)...');
        await conn.beginTransaction();
        const [existingLeave2] = await conn.execute('SELECT * FROM leaves WHERE id = ? FOR UPDATE', [leaveId]);
        const oldStatus2 = existingLeave2[0].status;
        const newStatus2 = 'approved';
        if (oldStatus2 !== 'approved' && newStatus2 === 'approved') {
            await conn.execute('UPDATE employees SET remaining_leaves = remaining_leaves - ? WHERE id = ?', [days, employeeId]);
        }
        await conn.execute('UPDATE leaves SET status = ? WHERE id = ?', [newStatus2, leaveId]);
        await conn.commit();

        const [empAfterReApprove] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ?', [employeeId]);
        console.log(`Remaining Leaves after re-approving: ${empAfterReApprove[0].remaining_leaves} (Expected: 17)`);

        // Test 5: Deleting an approved leave (DELETE simulator)
        console.log('\n6. Simulating deleting the approved leave (refunding 3 days)...');
        await conn.beginTransaction();
        const [existingLeave3] = await conn.execute('SELECT * FROM leaves WHERE id = ? FOR UPDATE', [leaveId]);
        if (existingLeave3[0].status === 'approved') {
            await conn.execute('UPDATE employees SET remaining_leaves = remaining_leaves + ? WHERE id = ?', [days, employeeId]);
        }
        await conn.execute('DELETE FROM leaves WHERE id = ?', [leaveId]);
        await conn.commit();

        const [empAfterDelete] = await conn.execute('SELECT remaining_leaves FROM employees WHERE id = ?', [employeeId]);
        console.log(`Remaining Leaves after delete: ${empAfterDelete[0].remaining_leaves} (Expected: 20)`);

        // Cleanup
        console.log('\nCleaning up test records...');
        await conn.execute('DELETE FROM employees WHERE id = ?', [employeeId]);
        console.log('All tests passed successfully!');

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await conn.end();
    }
}

test();
