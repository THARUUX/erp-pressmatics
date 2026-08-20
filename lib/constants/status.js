/**
 * Unified Status Constants & Utilities for Pressmatics ERP
 */

export const SO_STATUS = Object.freeze({
    PENDING: 'Pending',
    IN_PRODUCTION: 'In Production',
    READY: 'Ready',
    PARTIALLY_DELIVERED: 'Partially Delivered',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
});

export const TASK_STATUS = Object.freeze({
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    PAUSED: 'paused',
    DONE: 'done'
});

/**
 * Statuses that exclude a Sales Order from job planning queues & reports.
 * Fully delivered, completed, or cancelled orders are inactive for planning.
 */
export const INACTIVE_SO_STATUSES = Object.freeze([
    'Delivered',
    'Cancelled',
    'Completed'
]);

/**
 * Statuses that keep a Sales Order active in job planning queues.
 */
export const ACTIVE_SO_STATUSES = Object.freeze([
    'Pending',
    'In Production',
    'Ready',
    'Partially Delivered'
]);

/**
 * SQL WHERE snippet to exclude inactive Sales Orders from planning queries.
 * @param {string} alias Table alias for sales_orders (default: 'so')
 * @returns {string} SQL snippet
 */
export function getSQLExcludeInactiveSO(alias = 'so') {
    return `(${alias}.status NOT IN ('Delivered', 'Cancelled', 'Completed') AND LOWER(${alias}.status) NOT IN ('delivered', 'cancelled', 'completed'))`;
}

/**
 * SQL WHERE snippet to exclude done tasks from planning queries.
 * @param {string} alias Table alias for job_tasks (default: 'jt')
 * @returns {string} SQL snippet
 */
export function getSQLExcludeDoneTasks(alias = 'jt') {
    return `(${alias}.status IS NULL OR LOWER(${alias}.status) != 'done')`;
}

/**
 * Checks if a Sales Order status is inactive for planning (Delivered, Cancelled, Completed).
 * @param {string} status Status string to check
 * @returns {boolean}
 */
export function isInactiveSOStatus(status) {
    if (!status) return false;
    const lower = String(status).toLowerCase().trim();
    return lower === 'delivered' || lower === 'cancelled' || lower === 'completed';
}

/**
 * Checks if a task is marked done.
 * @param {string} status Task status string to check
 * @returns {boolean}
 */
export function isDoneTaskStatus(status) {
    if (!status) return false;
    return String(status).toLowerCase().trim() === 'done';
}
