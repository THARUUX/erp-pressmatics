/**
 * Real-Time Delivery Bottleneck Predictor Engine
 * Calculates estimated completion dates based on machine queue sequence, task runtimes,
 * and daily shift capacity limits to evaluate delivery breach risk.
 */

export const RISK_LEVEL = Object.freeze({
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
});

/**
 * Calculates delivery risk for a task or sales order.
 * @param {Object} item Task or Sales Order object
 * @param {number} precedingMinutesInQueue Total estimated minutes of tasks ahead in queue
 * @param {number} shiftLimitHours Daily shift hours limit (default: 8 hours)
 * @returns {Object} Risk evaluation result
 */
export function calculateJobDeliveryRisk(item, precedingMinutesInQueue = 0, shiftLimitHours = 8) {
    const status = String(item?.status || '').toLowerCase().trim();
    if (['done', 'completed', 'delivered'].includes(status)) {
        return {
            riskLevel: RISK_LEVEL.LOW,
            badgeLabel: status === 'done' ? 'Done' : 'Delivered',
            badgeColor: '#10b981',
            isHighRisk: false,
            isMediumRisk: false,
            delayDays: 0,
            estimatedCompletionDate: null
        };
    }

    const rawDeliveryDate = item?.delivery_date || item?.order_delivery_date;
    if (!rawDeliveryDate) {
        return {
            riskLevel: RISK_LEVEL.LOW,
            badgeLabel: 'No Target Date',
            badgeColor: '#64748b',
            isHighRisk: false,
            isMediumRisk: false,
            delayDays: 0,
            estimatedCompletionDate: null
        };
    }

    const taskMins = parseFloat(item.estimated_minutes || item.est_time || item.total_minutes || 0);
    const totalMinutes = taskMins + parseFloat(precedingMinutesInQueue || 0);

    const shiftMinsPerDay = (parseFloat(shiftLimitHours) || 8) * 60;
    const productionDaysNeeded = Math.max(1, Math.ceil(totalMinutes / shiftMinsPerDay));

    // Base start date: scheduled_date or today
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let startDate = now;
    if (item.scheduled_date) {
        const sDate = new Date(item.scheduled_date);
        if (!isNaN(sDate.getTime()) && sDate >= now) {
            startDate = sDate;
        }
    }

    const estimatedCompletion = new Date(startDate);
    estimatedCompletion.setDate(estimatedCompletion.getDate() + productionDaysNeeded);

    const deliveryDate = new Date(rawDeliveryDate);
    deliveryDate.setHours(23, 59, 59, 999);

    const timeDiffMs = deliveryDate.getTime() - estimatedCompletion.getTime();
    const diffDays = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        return {
            riskLevel: RISK_LEVEL.HIGH,
            badgeLabel: `Delayed Risk (+${overdueDays}d)`,
            badgeColor: '#ef4444',
            isHighRisk: true,
            isMediumRisk: false,
            delayDays: overdueDays,
            estimatedCompletionDate: estimatedCompletion,
            deliveryDate: deliveryDate
        };
    }

    if (diffDays <= 1) {
        return {
            riskLevel: RISK_LEVEL.MEDIUM,
            badgeLabel: 'Tight Deadline',
            badgeColor: '#f59e0b',
            isHighRisk: false,
            isMediumRisk: true,
            delayDays: 0,
            estimatedCompletionDate: estimatedCompletion,
            deliveryDate: deliveryDate
        };
    }

    return {
        riskLevel: RISK_LEVEL.LOW,
        badgeLabel: 'On Track',
        badgeColor: '#10b981',
        isHighRisk: false,
        isMediumRisk: false,
        delayDays: 0,
        estimatedCompletionDate: estimatedCompletion,
        deliveryDate: deliveryDate
    };
}

/**
 * Evaluates queue of tasks for a machine or finishing operation and attaches deliveryRisk object to each task.
 * @param {Array} tasks List of tasks sorted by queue sequence
 * @param {number} shiftLimitHours Machine shift limit (default 8)
 * @returns {Array} Tasks with attached deliveryRisk property
 */
export function evaluateTasksRiskInQueue(tasks = [], shiftLimitHours = 8) {
    let accumulatedMinutes = 0;
    return tasks.map(task => {
        const risk = calculateJobDeliveryRisk(task, accumulatedMinutes, shiftLimitHours);
        accumulatedMinutes += parseFloat(task.estimated_minutes || task.est_time || 0);
        return {
            ...task,
            deliveryRisk: risk
        };
    });
}
