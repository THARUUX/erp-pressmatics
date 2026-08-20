import { getSQLExcludeInactiveSO } from '../constants/status.js';

export class SalesOrderRepository {
    /**
     * Fetches active sales orders for the job planning module (excluding fully Delivered, Cancelled, Completed).
     * @param {import('mysql2/promise').Pool} pool MySQL database pool
     * @returns {Promise<Array>} List of sales orders
     */
    static async getPlanningSalesOrders(pool) {
        const [orders] = await pool.execute(
            `SELECT so.id, so.code, so.customer_name, so.status, so.delivery_date, so.quotation_id, so.kanban_position,
                    (SELECT GROUP_CONCAT(DISTINCT qi.estimation_name ORDER BY qi.id ASC SEPARATOR ' · ')
                     FROM quotation_items qi
                     JOIN quotation_line_items qli ON qi.id = qli.quotation_item_id
                     WHERE qli.quotation_id = so.quotation_id) AS estimation_names
             FROM sales_orders so
             WHERE LOWER(so.status) NOT IN ('cancelled')
               AND (
                   LOWER(so.status) NOT IN ('delivered', 'completed')
                   OR EXISTS (
                       SELECT 1 FROM job_tasks jt
                       WHERE jt.sales_order_id = so.id AND jt.scheduled_date IS NOT NULL
                   )
               )
             ORDER BY COALESCE(so.kanban_position, 999999) ASC, so.delivery_date ASC, so.id DESC`
        );
        return orders;
    }

    /**
     * Fetches a sales order by ID with basic fields.
     * @param {import('mysql2/promise').Pool} pool MySQL database pool
     * @param {number|string} id Sales Order ID
     * @returns {Promise<Object|null>} Sales order object or null
     */
    static async getById(pool, id) {
        const [rows] = await pool.execute(
            'SELECT * FROM sales_orders WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }
}

export default SalesOrderRepository;
