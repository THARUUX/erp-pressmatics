import React from 'react';
import {
    Document, Page, View, Text, StyleSheet
} from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 9, color: '#1f2937' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 16 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 180 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', letterSpacing: 0.5 },
    headerMachine: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#374151', marginTop: 3 },
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

const formatActualTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    try {
        const d = new Date(dateTimeStr);
        if (isNaN(d.getTime())) return '';
        let hrs = d.getHours();
        const mins = String(d.getMinutes()).padStart(2, '0');
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        hrs = hrs % 12;
        hrs = hrs ? hrs : 12;
        return `${String(hrs).padStart(2, '0')}:${mins} ${ampm}`;
    } catch (e) {
        return '';
    }
};

export default function MachineTasksDocument({ machine, weekRangeStr, stats, tasksByDay, reportType = 'weekly' }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const isDailyReport = reportType === 'daily';
    const isChecksheet = reportType === 'checksheet';

    // Filter out rows/days where there are no tasks
    const activeTasksByDay = tasksByDay.filter(item => item.tasks && item.tasks.length > 0);

    const colJobCode = isChecksheet ? '10%' : '12%';
    const colName = isChecksheet ? '27%' : '38%';
    const colDetails = isChecksheet ? '27%' : '35%';
    const colEst = isChecksheet ? '8%' : '8%';

    return (
        <Document title={`MachineSchedule-${machine.name}`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>
                            {isChecksheet
                                ? 'Daily Machine Task Sheet'
                                : (isDailyReport ? 'Daily Machine Schedule Report' : 'Weekly Machine Schedule Report')}
                        </Text>
                        <Text style={s.headerMachine}>{machine.name} • {machine.type.toUpperCase()}</Text>
                        <Text style={s.headerSub}>
                            {isChecksheet ? 'Manual Shopfloor Logging Checksheet' : 'Production Task List Wise Report'}
                        </Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerRange}>{weekRangeStr}</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats */}
                {isChecksheet ? null : (
                    <View style={s.statsGrid}>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>{isDailyReport || isChecksheet ? 'Daily Load' : 'Weekly Load'}</Text>
                            <Text style={s.statValue}>{stats.totalTasks} Tasks</Text>
                            <Text style={s.statSub}>{(stats.totalMinutes / 60).toFixed(1)} Hours Scheduled</Text>
                        </View>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>Completed Tasks</Text>
                            <Text style={s.statValue}>{stats.completedTasks} Done</Text>
                            <Text style={s.statSub}>{stats.completionRate}% Completion Rate</Text>
                        </View>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>Production State</Text>
                            <Text style={s.statValue}>{stats.pendingTasks} Pending</Text>
                            <Text style={s.statSub}>Requires Shopfloor Execution</Text>
                        </View>
                    </View>
                )}

                {/* Table */}
                <View style={s.table}>
                    <View style={s.tableHeader}>
                        <Text style={[s.tableHeaderText, { width: colJobCode }]}>Job Code</Text>
                        <Text style={[s.tableHeaderText, { width: colName }]}>Job / Customer Name</Text>
                        <Text style={[s.tableHeaderText, { width: colDetails }]}>Task Details</Text>
                        <Text style={[s.tableHeaderText, { width: colEst, textAlign: 'right' }]}>Est. Time</Text>
                        {isChecksheet ? (
                            <>
                                <Text style={[s.tableHeaderText, { width: '14%', textAlign: 'center', color: '#1e3a8a', fontFamily: 'Helvetica-Bold' }]}>Start / In-Progress</Text>
                                <Text style={[s.tableHeaderText, { width: '14%', textAlign: 'center', color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>Finish / Done</Text>
                            </>
                        ) : (
                            <Text style={[s.tableHeaderText, { width: '7%', textAlign: 'right' }]}>Status</Text>
                        )}
                    </View>

                    {activeTasksByDay.length === 0 ? (
                        <View style={s.tableRow}>
                            <Text style={[s.tableCell, { color: '#9ca3af', fontStyle: 'italic', width: '100%' }]}>
                                No tasks scheduled for this period
                            </Text>
                        </View>
                    ) : (
                        activeTasksByDay.map(({ dayLabel, dayDate, tasks }) => {
                            return (
                                <React.Fragment key={dayLabel}>
                                    {/* Day Divider Row */}
                                    <View style={s.tableRowDayHeader}>
                                        <Text style={s.tableRowDayHeaderText}>
                                            {dayLabel} {dayDate ? `(${dayDate})` : ''} — {tasks.length} tasks planned
                                        </Text>
                                    </View>

                                    {tasks.map(t => {
                                        const cleanName = t.name.includes('—')
                                            ? t.name.split('—')[t.name.split('—').length - 1].trim()
                                            : t.name;

                                        return (
                                            <View key={t.id} style={s.tableRow}>
                                                <Text style={[s.tableCellBold, { width: colJobCode }]}>{t.order_code || '—'}</Text>
                                                <Text style={[s.tableCell, { width: colName }]}>
                                                    {t.estimation_names || t.customer_name || '—'}
                                                </Text>
                                                <Text style={[s.tableCell, { width: colDetails }]}>
                                                    {cleanName} {t.description ? `(${t.description})` : ''}
                                                </Text>
                                                <Text style={[s.tableCell, { width: colEst, textAlign: 'right', paddingRight: 4 }]}>
                                                    {formatTime(t.estimated_minutes)}
                                                </Text>
                                                {isChecksheet ? (
                                                    <>
                                                        <View style={{ width: '14%', borderLeftWidth: 0.5, borderLeftColor: '#e5e7eb', paddingLeft: 6, justifyContent: 'center', height: 16 }}>
                                                            {/* <Text style={{ fontSize: 7, color: '#9ca3af', fontFamily: 'Helvetica' }}>
                                                                [  :  ] AM/PM
                                                            </Text> */}
                                                        </View>
                                                        <View style={{ width: '14%', borderLeftWidth: 0.5, borderLeftColor: '#e5e7eb', paddingLeft: 6, justifyContent: 'center', height: 16 }}>
                                                            {/* <Text style={{ fontSize: 7, color: '#9ca3af', fontFamily: 'Helvetica' }}>
                                                                [  :  ] AM/PM
                                                            </Text> */}
                                                        </View>
                                                    </>
                                                ) : (
                                                    <Text style={[s.tableCell, { width: '7%', textAlign: 'right', textTransform: 'capitalize' }]}>
                                                        {t.status}
                                                    </Text>
                                                )}
                                            </View>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })
                    )}
                </View>

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
