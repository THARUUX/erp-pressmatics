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

export default function MachineTasksDocument({ machine, weekRangeStr, stats, tasksByDay }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    
    return (
        <Document title={`MachineSchedule-${machine.name}`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>Weekly Machine Schedule Report</Text>
                        <Text style={s.headerMachine}>{machine.name} • {machine.type.toUpperCase()}</Text>
                        <Text style={s.headerSub}>Production Task List Wise Report</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerRange}>{weekRangeStr}</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={s.statsGrid}>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Weekly Load</Text>
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

                {/* Table */}
                <View style={s.table}>
                    <View style={s.tableHeader}>
                        <Text style={[s.tableHeaderText, { width: '12%' }]}>Job Code</Text>
                        <Text style={[s.tableHeaderText, { width: '38%' }]}>Job / Customer Name</Text>
                        <Text style={[s.tableHeaderText, { width: '35%' }]}>Task Details</Text>
                        <Text style={[s.tableHeaderText, { width: '8%', textAlign: 'right' }]}>Est. Time</Text>
                        <Text style={[s.tableHeaderText, { width: '7%', textAlign: 'right' }]}>Status</Text>
                    </View>

                    {tasksByDay.map(({ dayLabel, dayDate, tasks }) => {
                        return (
                            <React.Fragment key={dayLabel}>
                                {/* Day Divider Row */}
                                <View style={s.tableRowDayHeader}>
                                    <Text style={s.tableRowDayHeaderText}>
                                        {dayLabel} {dayDate ? `(${dayDate})` : ''} — {tasks.length} tasks planned
                                    </Text>
                                </View>

                                {tasks.length === 0 ? (
                                    <View style={s.tableRow}>
                                        <Text style={[s.tableCell, { color: '#9ca3af', fontStyle: 'italic', width: '100%' }]}>
                                            No tasks scheduled for this day
                                        </Text>
                                    </View>
                                ) : (
                                    tasks.map(t => {
                                        // clean prefix (e.g. "Offset Printing - ") to keep it clean
                                        const cleanName = t.name.includes('—')
                                            ? t.name.split('—')[t.name.split('—').length - 1].trim()
                                            : t.name;

                                        return (
                                            <View key={t.id} style={s.tableRow}>
                                                <Text style={[s.tableCellBold, { width: '12%' }]}>{t.order_code || '—'}</Text>
                                                <Text style={[s.tableCell, { width: '38%' }]}>
                                                    {t.estimation_names || t.customer_name || '—'}
                                                </Text>
                                                <Text style={[s.tableCell, { width: '35%' }]}>
                                                    {cleanName} {t.description ? `(${t.description})` : ''}
                                                </Text>
                                                <Text style={[s.tableCell, { width: '8%', textAlign: 'right' }]}>
                                                    {t.estimated_minutes ? `${t.estimated_minutes}m` : '0m'}
                                                </Text>
                                                <Text style={[s.tableCell, { width: '7%', textAlign: 'right', textTransform: 'capitalize' }]}>
                                                    {t.status}
                                                </Text>
                                            </View>
                                        );
                                    })
                                )}
                            </React.Fragment>
                        );
                    })}
                </View>

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
