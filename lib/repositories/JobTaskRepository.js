import { getSQLExcludeInactiveSO, getSQLExcludeDoneTasks } from '../constants/status.js';

export class JobTaskRepository {
    /**
     * Fetches unplanned tasks assigned to a specific machine.
     * Excludes inactive Sales Orders (Delivered, Cancelled, Completed) and done tasks.
     * @param {import('mysql2/promise').Pool} pool 
     * @param {number|string} machineId 
     * @returns {Promise<Array>}
     */
    static async getUnplannedTasksForMachine(pool, machineId) {
        const sqlSO = getSQLExcludeInactiveSO('so');
        const sqlTask = getSQLExcludeDoneTasks('jt');

        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date, so.job_notes,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.machine_id = ? AND jt.scheduled_date IS NULL
               AND (so.id IS NULL OR ${sqlSO})
               AND ${sqlTask}
             ORDER BY jt.machine_position ASC, jt.display_order ASC, jt.id ASC`,
            [machineId]
        );
        return tasks;
    }

    /**
     * Fetches unplanned finishing tasks (machine_id IS NULL).
     * @param {import('mysql2/promise').Pool} pool 
     * @returns {Promise<Array>}
     */
    static async getUnplannedTasksForFinishing(pool) {
        const sqlSO = getSQLExcludeInactiveSO('so');
        const sqlTask = getSQLExcludeDoneTasks('jt');

        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date, so.job_notes,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.machine_id IS NULL AND jt.scheduled_date IS NULL
               AND (so.id IS NULL OR ${sqlSO})
               AND ${sqlTask}
             ORDER BY so.delivery_date ASC, jt.display_order ASC`,
            []
        );
        return tasks;
    }

    /**
     * Fetches unplanned tasks assigned to a specific employee.
     * @param {import('mysql2/promise').Pool} pool 
     * @param {string} employeeName 
     * @returns {Promise<Array>}
     */
    static async getUnplannedTasksForEmployee(pool, employeeName) {
        const sqlSO = getSQLExcludeInactiveSO('so');
        const sqlTask = getSQLExcludeDoneTasks('jt');

        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date, so.job_notes,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.assigned_to = ?
               AND jt.scheduled_date IS NULL
               AND (so.id IS NULL OR ${sqlSO})
               AND ${sqlTask}
             ORDER BY jt.display_order ASC, jt.id ASC`,
            [employeeName]
        );
        return tasks;
    }

    /**
     * Fetches scheduled tasks for a specific machine or all finishing within a date range.
     * @param {import('mysql2/promise').Pool} pool 
     * @param {number|string|null} machineId Machine ID or null for finishing
     * @param {string} startDate Format YYYY-MM-DD
     * @param {string} endDate Format YYYY-MM-DD
     * @returns {Promise<Array>}
     */
    static async getScheduleTasksForMachine(pool, machineId, startDate, endDate) {
        const sqlSO = getSQLExcludeInactiveSO('so');
        const sqlTask = getSQLExcludeDoneTasks('jt');

        const machineCondition = machineId ? 'jt.machine_id = ?' : 'jt.machine_id IS NULL';
        const params = machineId ? [machineId, startDate, endDate] : [startDate, endDate];

        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
              FROM job_tasks jt
              LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
              WHERE ${machineCondition} AND (
                  (jt.scheduled_date BETWEEN ? AND ? AND (so.id IS NULL OR LOWER(so.status) != 'cancelled'))
                  OR (jt.scheduled_date IS NULL AND (so.id IS NULL OR ${sqlSO}) AND ${sqlTask})
              )
              ORDER BY jt.scheduled_date ASC, jt.machine_position ASC, jt.display_order ASC, jt.id ASC`,
            params
        );
        return tasks;
    }

    /**
     * Fetches scheduled tasks assigned to an employee within a date range.
     * @param {import('mysql2/promise').Pool} pool 
     * @param {string} employeeName 
     * @param {string} startDate Format YYYY-MM-DD
     * @param {string} endDate Format YYYY-MM-DD
     * @returns {Promise<Array>}
     */
    static async getScheduleTasksForEmployee(pool, employeeName, startDate, endDate) {
        const sqlSO = getSQLExcludeInactiveSO('so');
        const sqlTask = getSQLExcludeDoneTasks('jt');

        const [tasks] = await pool.execute(
            `SELECT jt.*, so.code as order_code, so.customer_name, so.delivery_date as order_delivery_date,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM job_tasks jt
             LEFT JOIN sales_orders so ON jt.sales_order_id = so.id
             WHERE jt.assigned_to = ? AND (
                 (jt.scheduled_date BETWEEN ? AND ? AND (so.id IS NULL OR LOWER(so.status) != 'cancelled'))
                 OR (jt.scheduled_date IS NULL AND (so.id IS NULL OR ${sqlSO}) AND ${sqlTask})
             )
             ORDER BY jt.scheduled_date ASC, jt.display_order ASC, jt.id ASC`,
            [employeeName, startDate, endDate]
        );
        return tasks;
    }
}

export default JobTaskRepository;
