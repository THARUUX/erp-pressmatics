/**
 * Date Operator & Keyword Filter Function for TanStack Table / Array filtering.
 * Supports:
 * - Comparison operators: >=, <=, >, <, =, != followed by YYYY-MM-DD or DD/MM/YYYY or YYYY-MM
 * - Date ranges: 2026-08-01..2026-08-10 or 2026-08-01 to 2026-08-10
 * - Keywords: today, yesterday, this week, last week, this month, last month, this year, last 7 days, last 30 days
 * - Partial text match: "Aug", "2026-08", "10 Aug", etc.
 */

function parseDateInput(str) {
    if (!str) return null;
    const s = str.trim();

    // Handle DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
        const d = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
        d.setHours(0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }

    // Handle YYYY-MM-DD
    const yyyymmdd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (yyyymmdd) {
        const d = new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
        d.setHours(0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }

    // Handle YYYY-MM
    const yyyymm = s.match(/^(\d{4})[\/\-](\d{1,2})$/);
    if (yyyymm) {
        const d = new Date(parseInt(yyyymm[1]), parseInt(yyyymm[2]) - 1, 1);
        d.setHours(0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }

    // Fallback Date parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        return d;
    }
    return null;
}

export const dateOperatorFilterFn = (row, columnId, filterValue) => {
    const rawVal = row.getValue(columnId);
    if (!rawVal) return false;

    const rowDate = new Date(rawVal);
    if (isNaN(rowDate.getTime())) return false;
    rowDate.setHours(0, 0, 0, 0);
    const rowTime = rowDate.getTime();

    const filter = String(filterValue || '').trim().toLowerCase();
    if (!filter) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Keyword check
    if (filter === 'today') {
        return rowTime === today.getTime();
    }
    if (filter === 'yesterday') {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        return rowTime === yest.getTime();
    }
    if (filter === 'this week' || filter === 'thisweek' || filter === 'week') {
        const dayOfWeek = today.getDay(); // 0 is Sun
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Mon
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return rowTime >= startOfWeek.getTime() && rowTime <= endOfWeek.getTime();
    }
    if (filter === 'this month' || filter === 'thismonth' || filter === 'month') {
        return rowDate.getFullYear() === today.getFullYear() && rowDate.getMonth() === today.getMonth();
    }
    if (filter === 'last month' || filter === 'lastmonth') {
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return rowDate.getFullYear() === lm.getFullYear() && rowDate.getMonth() === lm.getMonth();
    }
    if (filter === 'this year' || filter === 'thisyear' || filter === 'year') {
        return rowDate.getFullYear() === today.getFullYear();
    }
    if (filter === 'last 7 days' || filter === 'last7days' || filter === '7days') {
        const start = new Date(today);
        start.setDate(today.getDate() - 7);
        return rowTime >= start.getTime() && rowTime <= today.getTime();
    }
    if (filter === 'last 30 days' || filter === 'last30days' || filter === '30days') {
        const start = new Date(today);
        start.setDate(today.getDate() - 30);
        return rowTime >= start.getTime() && rowTime <= today.getTime();
    }

    // 2. Range match (e.g. 2026-08-01..2026-08-10 or 2026-08-01 to 2026-08-10)
    const rangeMatch = filter.match(/^(.+?)\s*(\.\.|to|\-\-)\s*(.+)$/i);
    if (rangeMatch) {
        const d1 = parseDateInput(rangeMatch[1]);
        const d2 = parseDateInput(rangeMatch[3]);
        if (d1 && d2) {
            return rowTime >= d1.getTime() && rowTime <= d2.getTime();
        }
    }

    // 3. Comparison operators (>=, <=, >, <, !=, =, ==)
    const opMatch = filter.match(/^([><=!]=?)\s*(.+)$/);
    if (opMatch) {
        const op = opMatch[1];
        const targetDate = parseDateInput(opMatch[2]);
        if (targetDate) {
            const targetTime = targetDate.getTime();
            switch (op) {
                case '>':  return rowTime > targetTime;
                case '>=': return rowTime >= targetTime;
                case '<':  return rowTime < targetTime;
                case '<=': return rowTime <= targetTime;
                case '!=': return rowTime !== targetTime;
                case '=':
                case '==': return rowTime === targetTime;
                default:   return true;
            }
        }
    }

    // 4. Default: Text search on formatted date string
    const formattedGB = rowDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase();
    const formattedISO = rowDate.toISOString().split('T')[0];
    const formattedFull = rowDate.toDateString().toLowerCase();

    return formattedGB.includes(filter) || formattedISO.includes(filter) || formattedFull.includes(filter);
};
