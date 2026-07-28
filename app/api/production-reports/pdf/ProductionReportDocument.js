import React from 'react';
import {
    Document, Page, View, Text, StyleSheet
} from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 8.5, color: '#1f2937' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 16 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 180 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', letterSpacing: 0.5 },
    headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerDate: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#4b5563' },
    
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCell: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', padding: '8 12', borderRadius: 4 },
    statLabel: { fontSize: 7, textTransform: 'uppercase', color: '#6b7280', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827' },
    statSub: { fontSize: 7.5, color: '#4b5563', marginTop: 1 },

    machineSection: { marginBottom: 22, avoidBreak: true },
    machineTitleRow: { backgroundColor: '#f3f4f6', padding: '5 8', borderLeftWidth: 3, borderLeftColor: '#0f172a', marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    machineTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a', textTransform: 'uppercase' },
    machineMeta: { fontSize: 7.5, color: '#4b5563', fontFamily: 'Helvetica-Bold' },

    table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: '5 8' },
    tableHeaderText: { fontSize: 7, textTransform: 'uppercase', color: '#4b5563', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '5 8', alignItems: 'center' },
    
    tableCell: { fontSize: 7.5, color: '#374151' },
    tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
    
    statusBadge: { padding: '2 4', borderRadius: 2, fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'center', width: 52 },
    status_done: { backgroundColor: '#dcfce7', color: '#15803d' },
    status_in_progress: { backgroundColor: '#fef3c7', color: '#d97706' },
    status_pending: { backgroundColor: '#f3f4f6', color: '#4b5563' },
    
    varianceText: { fontFamily: 'Helvetica-Bold' },
    varianceBetter: { color: '#16a34a' },
    varianceWorse: { color: '#dc2626' },
    varianceNone: { color: '#6b7280' },

    footer: { position: 'absolute', bottom: 14, left: 24, right: 24, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#9ca3af' },
});

function formatDuration(mins) {
    if (mins == null) return '—';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round((mins / 60) * 10) / 10;
    return `${hrs}h`;
}

function formatVariance(estimated, actual) {
    if (estimated == null || actual == null) return '—';
    const diff = actual - estimated;
    if (diff === 0) return '0m';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}m`;
}

function getVarianceStyle(estimated, actual) {
    if (estimated == null || actual == null) return s.varianceNone;
    const diff = actual - estimated;
    if (diff === 0) return s.varianceNone;
    return diff > 0 ? s.varianceWorse : s.varianceBetter;
}

export default function ProductionReportDocument({ dateStr, stats, machines }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const totalHoursEst = (stats.totalEstimatedMinutes / 60).toFixed(1);
    const totalHoursAct = (stats.totalActualMinutes / 60).toFixed(1);
    const completionRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

    return (
        <Document title={`DailyProductionReport-${dateStr}`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>Daily Production Report</Text>
                        <Text style={s.headerSub}>Machine-Wise Production Performance and Efficiency Tracking</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerDate}>{formattedDate}</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Overall Stats */}
                <View style={s.statsGrid}>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Daily Task Load</Text>
                        <Text style={s.statValue}>{stats.totalTasks} Tasks</Text>
                        <Text style={s.statSub}>Scheduled across all machines</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Completed Tasks</Text>
                        <Text style={s.statValue}>{stats.completedTasks} / {stats.totalTasks}</Text>
                        <Text style={s.statSub}>{completionRate}% Completion Rate</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Estimated Time</Text>
                        <Text style={s.statValue}>{totalHoursEst} Hours</Text>
                        <Text style={s.statSub}>{stats.totalEstimatedMinutes} total minutes</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Actual Production Time</Text>
                        <Text style={s.statValue}>{totalHoursAct} Hours</Text>
                        <Text style={s.statSub}>{stats.totalActualMinutes} total minutes for completed tasks</Text>
                    </View>
                </View>

                {/* Machines List */}
                {machines.length === 0 ? (
                    <View style={[s.table, { padding: '12 15', borderStyle: 'dashed', marginTop: 10, alignItems: 'center' }]}>
                        <Text style={[s.tableCell, { color: '#9ca3af', fontStyle: 'italic', fontSize: 9 }]}>
                            No tasks were scheduled or run on any machine for this date.
                        </Text>
                    </View>
                ) : (
                    machines.map(m => {
                        const mTasks = m.tasks || [];
                        const mEstimated = mTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
                        const mActual = mTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);

                        return (
                            <View key={m.id} style={s.machineSection}>
                                {/* Machine Group Header */}
                                <View style={s.machineTitleRow}>
                                    <Text style={s.machineTitle}>{m.name} ({m.type})</Text>
                                    <Text style={s.machineMeta}>
                                        {mTasks.length} tasks • Est: {formatDuration(mEstimated)} • Act: {formatDuration(mActual)}
                                    </Text>
                                </View>

                                {/* Table */}
                                <View style={s.table}>
                                    <View style={s.tableHeader}>
                                        <Text style={[s.tableHeaderText, { width: '10%' }]}>SO Code</Text>
                                        <Text style={[s.tableHeaderText, { width: '22%' }]}>Customer</Text>
                                        <Text style={[s.tableHeaderText, { width: '32%' }]}>Task Name / Details</Text>
                                        <Text style={[s.tableHeaderText, { width: '9%', textAlign: 'center' }]}>Status</Text>
                                        <Text style={[s.tableHeaderText, { width: '9%', textAlign: 'right' }]}>Est. Time</Text>
                                        <Text style={[s.tableHeaderText, { width: '9%', textAlign: 'right' }]}>Act. Time</Text>
                                        <Text style={[s.tableHeaderText, { width: '9%', textAlign: 'right' }]}>Variance</Text>
                                    </View>

                                    {mTasks.map(t => {
                                        const parts = t.name.split('—');
                                        const cleanName = parts[parts.length - 1]?.trim() || t.name;
                                        const operationDetail = parts.length > 2 ? parts[1]?.trim() : '';
                                        const displayText = operationDetail ? `${cleanName} (${operationDetail})` : cleanName;

                                        const statusStyle = s[`status_${t.status}`] || s.status_pending;

                                        return (
                                            <View key={t.id} style={s.tableRow}>
                                                <Text style={[s.tableCellBold, { width: '10%' }]}>{t.order_code || '—'}</Text>
                                                <Text style={[s.tableCell, { width: '22%' }]} numberOfLines={1}>{t.customer_name || '—'}</Text>
                                                <Text style={[s.tableCell, { width: '32%' }]} numberOfLines={1}>
                                                    {displayText}
                                                </Text>
                                                <View style={{ width: '9%', alignItems: 'center' }}>
                                                    <Text style={[s.statusBadge, statusStyle]}>{t.status}</Text>
                                                </View>
                                                <Text style={[s.tableCell, { width: '9%', textAlign: 'right' }]}>
                                                    {formatDuration(t.estimated_minutes)}
                                                </Text>
                                                <Text style={[s.tableCell, { width: '9%', textAlign: 'right' }]}>
                                                    {formatDuration(t.actual_minutes)}
                                                </Text>
                                                <Text style={[s.tableCell, getVarianceStyle(t.estimated_minutes, t.actual_minutes), s.varianceText, { width: '9%', textAlign: 'right' }]}>
                                                    {formatVariance(t.estimated_minutes, t.actual_minutes)}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })
                )}

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Daily Production Report • Issued: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
