export const numericOperatorFilterFn = (row, columnId, filterValue) => {
    const value = parseFloat(row.getValue(columnId) || 0);
    const filter = String(filterValue).trim();

    // Match operators: >=, <=, >, <, !=, =, == followed by optional spaces and a number
    const match = filter.match(/^([><=!]=?)\s*(-?\d+(\.\d+)?)$/);
    if (match) {
        const op = match[1];
        const num = parseFloat(match[2]);
        switch (op) {
            case '>':  return value > num;
            case '>=': return value >= num;
            case '<':  return value < num;
            case '<=': return value <= num;
            case '!=': return value !== num;
            case '=':
            case '==': return value === num;
            default:   return true;
        }
    }

    // Default: text inclusion or numeric exact match
    if (!isNaN(filter) && filter !== '') {
        return value === parseFloat(filter);
    }
    return String(value).toLowerCase().includes(filter.toLowerCase());
};
