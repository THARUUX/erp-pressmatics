import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 9, color: '#1f2937' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 16 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 180 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', letterSpacing: 0.5 },
    headerSub2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#374151', marginTop: 3 },
    headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerRange: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4b5563' },

    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statCell: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', padding: '8 12', borderRadius: 4 },
    statLabel: { fontSize: 7, textTransform: 'uppercase', color: '#6b7280', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827' },
    statSub: { fontSize: 7.5, color: '#4b5563', marginTop: 1 },

    table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: '6 8' },
    tableHeaderText: { fontSize: 7, textTransform: 'uppercase', color: '#4b5563', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '6 8', alignItems: 'center' },
    tableRowDayHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '5 8' },
    tableRowDayHeaderText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#374151' },

    tableCell: { fontSize: 8, color: '#374151' },
    tableCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },

    footer: { position: 'absolute', bottom: 14, left: 24, right: 24, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#9ca3af' },
});

const formatTime = (mins) => {
    if (!mins) return '0m';
    if (mins >= 60) {
        const hrs = mins / 60;
        return `${Number(hrs.toFixed(1))}h`;
    }
    return `${mins}m`;
};

const getWidths = (selectedColumns = [], hasChecksheetCols) => {
    const defaultWidths = { code: 12, customer: 30, name: 30, quantity: 8, time: 8, status: 7 };
    let activeColumns = selectedColumns.filter(c => c !== 'specs' && c !== 'notes' && c !== 'finishings' && c !== 'delivery');
    if (activeColumns.length === 0) activeColumns = ['code', 'customer', 'name', 'time', 'status'];

    let activeWidths = {};
    let totalWeight = 0;
    activeColumns.forEach(col => {
        if (defaultWidths[col] !== undefined) {
            activeWidths[col] = defaultWidths[col];
            totalWeight += defaultWidths[col];
        }
    });

    const normalized = {};
    const remainingPct = hasChecksheetCols ? 72 : 100;
    Object.keys(activeWidths).forEach(col => {
        normalized[col] = `${((activeWidths[col] / totalWeight) * remainingPct).toFixed(1)}%`;
    });
    return normalized;
};

export default function EmployeeTasksDocument({ employee, weekRangeStr, stats, tasksByDay, reportType = 'weekly', options }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const isDailyReport = reportType === 'daily';
    const isChecksheet = reportType === 'checksheet';
    const selectedColumns = options?.columns || ['code', 'customer', 'name', 'time', 'status'];

    const activeTasksByDay = tasksByDay.filter(item => item.tasks && item.tasks.length > 0);
    const colWidths = getWidths(selectedColumns, isChecksheet);

    const deptDisplay = [employee.job_title, employee.department].filter(Boolean).join(' • ');

    return (
        <Document title={`EmployeeSchedule-${employee.name}`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>
                            {isChecksheet
                                ? 'Employee Daily Task Sheet'
                                : (isDailyReport ? 'Daily Employee Schedule Report' : 'Weekly Employee Schedule Report')}
                        </Text>
                        <Text style={s.headerSub2}>{employee.name} {deptDisplay ? `• ${deptDisplay}` : ''}</Text>
                        <Text style={s.headerSub}>
                            {isChecksheet ? 'Manual Task Completion Checksheet' : 'Employee Task Assignment Report'}
                        </Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerRange}>{weekRangeStr}</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats */}
                {(isChecksheet || options?.includeStats === false) ? null : (
                    <View style={s.statsGrid}>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>{isDailyReport ? 'Daily Load' : 'Weekly Load'}</Text>
                            <Text style={s.statValue}>{stats.totalTasks} Tasks</Text>
                            <Text style={s.statSub}>{(stats.totalMinutes / 60).toFixed(1)} Hours Scheduled</Text>
                        </View>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>Completed Tasks</Text>
                            <Text style={s.statValue}>{stats.completedTasks} Done</Text>
                            <Text style={s.statSub}>{stats.completionRate}% Completion Rate</Text>
                        </View>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>Pending Tasks</Text>
                            <Text style={s.statValue}>{stats.pendingTasks} Pending</Text>
                            <Text style={s.statSub}>Awaiting Completion</Text>
                        </View>
                    </View>
                )}

                {/* Table */}
                <View style={s.table}>
                    <View style={s.tableHeader}>
                        {selectedColumns.includes('code') && <Text style={[s.tableHeaderText, { width: colWidths.code }]}>Job Code</Text>}
                        {selectedColumns.includes('customer') && <Text style={[s.tableHeaderText, { width: colWidths.customer }]}>Job / Customer</Text>}
                        {selectedColumns.includes('name') && <Text style={[s.tableHeaderText, { width: colWidths.name }]}>Task Details</Text>}
                        {selectedColumns.includes('quantity') && <Text style={[s.tableHeaderText, { width: colWidths.quantity, textAlign: 'right' }]}>Qty</Text>}
                        {selectedColumns.includes('time') && <Text style={[s.tableHeaderText, { width: colWidths.time, textAlign: 'right' }]}>Est. Time</Text>}
                        {isChecksheet ? (
                            <>
                                <Text style={[s.tableHeaderText, { width: '14%', textAlign: 'center', color: '#1e3a8a', fontFamily: 'Helvetica-Bold' }]}>Start / In-Progress</Text>
                                <Text style={[s.tableHeaderText, { width: '14%', textAlign: 'center', color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>Finish / Done</Text>
                            </>
                        ) : (
                            selectedColumns.includes('status') && <Text style={[s.tableHeaderText, { width: colWidths.status, textAlign: 'right' }]}>Status</Text>
                        )}
                    </View>

                    {activeTasksByDay.length === 0 ? (
                        <View style={s.tableRow}>
                            <Text style={[s.tableCell, { color: '#9ca3af', fontStyle: 'italic', width: '100%' }]}>
                                No tasks scheduled for this period
                            </Text>
                        </View>
                    ) : (
                        activeTasksByDay.map(({ dayLabel, dayDate, tasks }) => (
                            <React.Fragment key={dayLabel}>
                                <View style={s.tableRowDayHeader}>
                                    <Text style={s.tableRowDayHeaderText}>
                                        {dayLabel} {dayDate ? `(${dayDate})` : ''} — {tasks.length} task{tasks.length !== 1 ? 's' : ''} planned
                                    </Text>
                                </View>
                                {tasks.map(t => {
                                    const parts = t.name.split('—');
                                    const cleanName = parts[parts.length - 1]?.trim() || t.name;
                                    const operationDetail = parts.length > 2 ? parts[1]?.trim() : '';
                                    const displayText = operationDetail ? `${cleanName} (${operationDetail})` : cleanName;

                                    return (
                                        <View key={t.id} style={s.tableRow}>
                                            {selectedColumns.includes('code') && <Text style={[s.tableCellBold, { width: colWidths.code }]}>{t.order_code || '—'}</Text>}
                                            {selectedColumns.includes('customer') && (
                                                <Text style={[s.tableCell, { width: colWidths.customer }]}>
                                                    {t.estimation_names || t.customer_name || '—'}
                                                </Text>
                                            )}
                                            {selectedColumns.includes('name') && <Text style={[s.tableCell, { width: colWidths.name }]}>{displayText}</Text>}
                                            {selectedColumns.includes('quantity') && (
                                                <Text style={[s.tableCell, { width: colWidths.quantity, textAlign: 'right', paddingRight: 4 }]}>
                                                    {parseFloat(t.quantity) || 0}
                                                </Text>
                                            )}
                                            {selectedColumns.includes('time') && (
                                                <Text style={[s.tableCell, { width: colWidths.time, textAlign: 'right', paddingRight: 4 }]}>
                                                    {formatTime(t.estimated_minutes)}
                                                </Text>
                                            )}
                                            {isChecksheet ? (
                                                <>
                                                    <View style={{ width: '14%', borderLeftWidth: 0.5, borderLeftColor: '#e5e7eb', paddingLeft: 6, justifyContent: 'center', height: 16 }} />
                                                    <View style={{ width: '14%', borderLeftWidth: 0.5, borderLeftColor: '#e5e7eb', paddingLeft: 6, justifyContent: 'center', height: 16 }} />
                                                </>
                                            ) : (
                                                selectedColumns.includes('status') && (
                                                    <Text style={[s.tableCell, { width: colWidths.status, textAlign: 'right', textTransform: 'capitalize' }]}>
                                                        {t.status}
                                                    </Text>
                                                )
                                            )}
                                        </View>
                                    );
                                })}
                            </React.Fragment>
                        ))
                    )}
                </View>

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) =>
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                } />
            </Page>
        </Document>
    );
}
