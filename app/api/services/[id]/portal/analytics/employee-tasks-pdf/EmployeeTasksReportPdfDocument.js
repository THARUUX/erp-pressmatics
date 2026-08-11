import React from 'react';
import {
    Document, Page, View, Text, StyleSheet
} from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 8.5, color: '#1f2937' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#4f46e5', paddingBottom: 8, marginBottom: 14 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 200 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', letterSpacing: 0.5 },
    headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerDate: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4338ca' },

    employeeSection: { marginBottom: 18, avoidBreak: true },
    employeeHeaderRow: { backgroundColor: '#f1f5f9', padding: '6 8', borderLeftWidth: 3.5, borderLeftColor: '#4f46e5', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    employeeName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', textTransform: 'uppercase' },
    employeeMeta: { fontSize: 7.5, color: '#475569', fontFamily: 'Helvetica-Bold' },

    table: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', padding: '5 8' },
    tableHeaderText: { fontSize: 7, textTransform: 'uppercase', color: '#475569', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', padding: '5 8', alignItems: 'center' },
    tableRowAlt: { backgroundColor: '#fafafa' },

    tableCell: { fontSize: 7.5, color: '#334155' },
    tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    tableCellRight: { textAlign: 'right' },
    tableCellCenter: { textAlign: 'center' },

    badge: { padding: '2 4', borderRadius: 2, fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'center', width: 50 },
    badge_done: { backgroundColor: '#dcfce7', color: '#15803d' },
    badge_in_progress: { backgroundColor: '#fef3c7', color: '#d97706' },
    badge_pending: { backgroundColor: '#f1f5f9', color: '#475569' },

    varianceText: { fontFamily: 'Helvetica-Bold' },
    varianceBetter: { color: '#16a34a' },
    varianceWorse: { color: '#dc2626' },
    varianceNone: { color: '#64748b' },

    footer: { position: 'absolute', bottom: 14, left: 24, right: 24, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#94a3b8' },
});

function formatDuration(mins) {
    if (mins == null || mins === 0) return '—';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round((mins / 60) * 10) / 10;
    return `${hrs}h`;
}

function formatVariance(estimated, actual) {
    if (!estimated || !actual) return '—';
    const diff = actual - estimated;
    if (diff === 0) return '0m';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}m`;
}

function getVarianceStyle(estimated, actual) {
    if (!estimated || !actual) return s.varianceNone;
    const diff = actual - estimated;
    if (diff === 0) return s.varianceNone;
    return diff > 0 ? s.varianceWorse : s.varianceBetter;
}

const DEFAULT_COLS = ['code', 'customer', 'name', 'status', 'est_time', 'act_time', 'variance', 'cost'];

export default function EmployeeTasksReportPdfDocument({ serviceName, employeesData, selectedColumns = DEFAULT_COLS }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const issueDate = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });

    const activeCols = selectedColumns.length > 0 ? selectedColumns : DEFAULT_COLS;

    // Calculate column widths based on active selection
    const colWeights = {
        code: 9,
        customer: 19,
        name: 30,
        status: 10,
        est_time: 8,
        act_time: 8,
        variance: 8,
        cost: 8,
    };
    let totalWeight = 0;
    activeCols.forEach(c => {
        totalWeight += colWeights[c] || 10;
    });
    const colWidths = {};
    activeCols.forEach(c => {
        colWidths[c] = `${(((colWeights[c] || 10) / totalWeight) * 100).toFixed(1)}%`;
    });

    let grandTotalTasks = 0;
    let grandTotalActMins = 0;
    employeesData.forEach(e => {
        grandTotalTasks += e.tasks.length;
        grandTotalActMins += e.totalActMins;
    });
    const grandTotalHours = (grandTotalActMins / 60).toFixed(1);

    return (
        <Document title={`Employee-Wise-Task-Report`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>Employee-Wise Task Detailed Report</Text>
                        <Text style={s.headerSub}>{serviceName || 'Services Portal'} • Custom Task Breakdown &amp; Labor Analysis</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerDate}>{grandTotalTasks} Tasks • {grandTotalHours} Total Hours</Text>
                        <Text style={[s.headerSub, { marginTop: 3 }]}>Generated: {issueDate} {timestamp}</Text>
                    </View>
                </View>

                {/* Employees Sections */}
                {employeesData.length === 0 ? (
                    <View style={[s.table, { padding: 15, alignItems: 'center' }]}>
                        <Text style={{ fontSize: 9, color: '#94a3b8' }}>No task logs matching the selected filters.</Text>
                    </View>
                ) : (
                    employeesData.map(emp => {
                        const estHours = (emp.totalEstMins / 60).toFixed(1);
                        const actHours = (emp.totalActMins / 60).toFixed(1);
                        const doneCount = emp.tasks.filter(t => t.status === 'done').length;

                        return (
                            <View key={emp.name} style={s.employeeSection}>
                                {/* Employee Header */}
                                <View style={s.employeeHeaderRow}>
                                    <Text style={s.employeeName}>
                                        {emp.name.toLowerCase() === 'operator' ? 'Unplanned' : emp.name}
                                    </Text>
                                    <Text style={s.employeeMeta}>
                                        {emp.tasks.length} Tasks ({doneCount} Done) — Est: {estHours}h — Act Logged: {actHours}h — Cost: LKR {emp.totalLaborVal.toLocaleString()}
                                    </Text>
                                </View>

                                {/* Task Table */}
                                <View style={s.table}>
                                    <View style={s.tableHeader}>
                                        {activeCols.includes('code') && <Text style={[s.tableHeaderText, { width: colWidths.code }]}>SO Code</Text>}
                                        {activeCols.includes('customer') && <Text style={[s.tableHeaderText, { width: colWidths.customer }]}>Customer Name</Text>}
                                        {activeCols.includes('name') && <Text style={[s.tableHeaderText, { width: colWidths.name }]}>Task Name / Details</Text>}
                                        {activeCols.includes('status') && <Text style={[s.tableHeaderText, { width: colWidths.status, textAlign: 'center' }]}>Status</Text>}
                                        {activeCols.includes('est_time') && <Text style={[s.tableHeaderText, { width: colWidths.est_time, textAlign: 'right' }]}>Est. Time</Text>}
                                        {activeCols.includes('act_time') && <Text style={[s.tableHeaderText, { width: colWidths.act_time, textAlign: 'right' }]}>Act. Time</Text>}
                                        {activeCols.includes('variance') && <Text style={[s.tableHeaderText, { width: colWidths.variance, textAlign: 'right' }]}>Variance</Text>}
                                        {activeCols.includes('cost') && <Text style={[s.tableHeaderText, { width: colWidths.cost, textAlign: 'right' }]}>Labor Cost</Text>}
                                    </View>

                                    {emp.tasks.map((t, idx) => {
                                        const isAlt = idx % 2 === 1;
                                        const statusStyle = s[`badge_${t.status}`] || s.badge_pending;
                                        const estM = Number(t.estimated_minutes || 0);
                                        const actM = Number(t.empActualMins || Math.round((t.actual_seconds || 0) / 60));
                                        const laborCost = Math.round((actM / 60) * emp.hourlyRate);

                                        return (
                                            <View key={t.id} style={[s.tableRow, isAlt ? s.tableRowAlt : {}]}>
                                                {activeCols.includes('code') && <Text style={[s.tableCellBold, { width: colWidths.code }]}>{t.order_code || '—'}</Text>}
                                                {activeCols.includes('customer') && <Text style={[s.tableCell, { width: colWidths.customer }]} numberOfLines={1}>{t.customer_name || '—'}</Text>}
                                                {activeCols.includes('name') && <Text style={[s.tableCell, { width: colWidths.name }]} numberOfLines={1}>{t.name.split("—")?.[1] || 'Task'}</Text>}
                                                {activeCols.includes('status') && (
                                                    <View style={{ width: colWidths.status, alignItems: 'center' }}>
                                                        <Text style={[s.badge, statusStyle]}>{t.status || 'pending'}</Text>
                                                    </View>
                                                )}
                                                {activeCols.includes('est_time') && (
                                                    <Text style={[s.tableCell, s.tableCellRight, { width: colWidths.est_time }]}>
                                                        {formatDuration(estM)}
                                                    </Text>
                                                )}
                                                {activeCols.includes('act_time') && (
                                                    <Text style={[s.tableCellBold, s.tableCellRight, { width: colWidths.act_time, color: '#4338ca' }]}>
                                                        {formatDuration(actM)}
                                                    </Text>
                                                )}
                                                {activeCols.includes('variance') && (
                                                    <Text style={[s.tableCell, getVarianceStyle(estM, actM), s.varianceText, s.tableCellRight, { width: colWidths.variance }]}>
                                                        {formatVariance(estM, actM)}
                                                    </Text>
                                                )}
                                                {activeCols.includes('cost') && (
                                                    <Text style={[s.tableCellBold, s.tableCellRight, { width: colWidths.cost, color: '#15803d' }]}>
                                                        LKR {laborCost.toLocaleString()}
                                                    </Text>
                                                )}
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
                    `Pressmatics Cloud ERP • Employee-Wise Task Detailed Report • Issued: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
