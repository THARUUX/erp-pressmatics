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

    table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: '6 8' },
    tableHeaderText: { fontSize: 7.5, textTransform: 'uppercase', color: '#4b5563', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '6 8', alignItems: 'center' },

    tableCell: { fontSize: 8, color: '#374151' },
    tableCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },

    footer: { position: 'absolute', bottom: 14, left: 24, right: 24, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#9ca3af' },
});

const formatTime = (mins) => {
    if (!mins) return '0m';
    if (mins >= 60) return `${Number((mins / 60).toFixed(1))}h`;
    return `${mins}m`;
};

const getFlatWidths = (selectedColumns = []) => {
    const activeColumns = selectedColumns.length > 0 ? selectedColumns : ['code', 'customer', 'name', 'delivery', 'quantity', 'time', 'status'];
    const defaultWidths = { code: 10, customer: 22, name: 33, delivery: 12, quantity: 10, time: 7, status: 6 };
    let activeWidths = {};
    let totalWeight = 0;
    activeColumns.forEach(col => {
        if (defaultWidths[col] !== undefined) {
            activeWidths[col] = defaultWidths[col];
            totalWeight += defaultWidths[col];
        }
    });
    const normalized = {};
    Object.keys(activeWidths).forEach(col => {
        normalized[col] = `${((activeWidths[col] / totalWeight) * 100).toFixed(1)}%`;
    });
    return normalized;
};

export default function EmployeeUnplannedPdfDocument({ employee, stats, tasks, options }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const selectedColumns = options.columns || [];
    const flatWidths = getFlatWidths(selectedColumns);
    const deptDisplay = [employee.job_title, employee.department].filter(Boolean).join(' • ');

    return (
        <Document title={`UnplannedQueue-${employee.name}`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>Employee Unplanned Task Queue</Text>
                        <Text style={s.headerSub2}>{employee.name} {deptDisplay ? `• ${deptDisplay}` : ''}</Text>
                        <Text style={s.headerSub}>Backlog — Tasks Pending Scheduling</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerRange}>All Unplanned Tasks</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats */}
                {options.includeStats !== false ? (
                    <View style={s.statsGrid}>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>Total Queue</Text>
                            <Text style={s.statValue}>{stats.totalTasks} Tasks</Text>
                            <Text style={s.statSub}>Pending Scheduling</Text>
                        </View>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>Run Quantity</Text>
                            <Text style={s.statValue}>{stats.totalQty.toLocaleString()}</Text>
                            <Text style={s.statSub}>Total Operations</Text>
                        </View>
                        <View style={s.statCell}>
                            <Text style={s.statLabel}>Estimated Time</Text>
                            <Text style={s.statValue}>{stats.totalHours.toFixed(1)} Hrs</Text>
                            <Text style={s.statSub}>Based on Task Estimates</Text>
                        </View>
                    </View>
                ) : null}

                {/* Table */}
                <View style={s.table}>
                    <View style={s.tableHeader}>
                        {selectedColumns.includes('code') && <Text style={[s.tableHeaderText, { width: flatWidths.code }]}>Job Code</Text>}
                        {selectedColumns.includes('customer') && <Text style={[s.tableHeaderText, { width: flatWidths.customer }]}>Customer Name</Text>}
                        {selectedColumns.includes('name') && <Text style={[s.tableHeaderText, { width: flatWidths.name }]}>Task Details</Text>}
                        {selectedColumns.includes('delivery') && <Text style={[s.tableHeaderText, { width: flatWidths.delivery }]}>Delivery</Text>}
                        {selectedColumns.includes('quantity') && <Text style={[s.tableHeaderText, { width: flatWidths.quantity, textAlign: 'right' }]}>Qty</Text>}
                        {selectedColumns.includes('time') && <Text style={[s.tableHeaderText, { width: flatWidths.time, textAlign: 'right' }]}>Est. Time</Text>}
                        {selectedColumns.includes('status') && <Text style={[s.tableHeaderText, { width: flatWidths.status, textAlign: 'right' }]}>Status</Text>}
                    </View>

                    {tasks.length === 0 ? (
                        <View style={s.tableRow}>
                            <Text style={[s.tableCell, { color: '#9ca3af', fontStyle: 'italic', width: '100%' }]}>
                                No unplanned tasks for this employee
                            </Text>
                        </View>
                    ) : tasks.map((t, idx) => {
                        const parts = t.name ? t.name.split('—') : [];
                        const taskName = parts.length >= 2 ? parts[parts.length - 2]?.trim() : (t.name || 'Task');
                        const cleanName = parts[parts.length - 1]?.trim() || t.name;
                        const operationDetail = parts.length > 2 ? parts[1]?.trim() : '';
                        const displayText = t.sales_order_id === null
                            ? taskName
                            : (operationDetail ? `${cleanName} (${operationDetail})` : cleanName);

                        return (
                            <View key={idx} style={s.tableRow}>
                                {selectedColumns.includes('code') && <Text style={[s.tableCellBold, { width: flatWidths.code }]}>{t.order_code || '—'}</Text>}
                                {selectedColumns.includes('customer') && (
                                    <Text style={[s.tableCell, { width: flatWidths.customer }]}>
                                        {t.sales_order_id === null ? 'Standalone Task' : (t.customer_name || '—')}
                                    </Text>
                                )}
                                {selectedColumns.includes('name') && <Text style={[s.tableCellBold, { width: flatWidths.name }]}>{displayText}</Text>}
                                {selectedColumns.includes('delivery') && (
                                    <Text style={[s.tableCell, { width: flatWidths.delivery }]}>
                                        {t.order_delivery_date ? new Date(t.order_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                    </Text>
                                )}
                                {selectedColumns.includes('quantity') && <Text style={[s.tableCell, { width: flatWidths.quantity, textAlign: 'right' }]}>{(parseFloat(t.quantity) || 0).toLocaleString()}</Text>}
                                {selectedColumns.includes('time') && <Text style={[s.tableCell, { width: flatWidths.time, textAlign: 'right' }]}>{formatTime(t.estimated_minutes)}</Text>}
                                {selectedColumns.includes('status') && <Text style={[s.tableCell, { width: flatWidths.status, textAlign: 'right', textTransform: 'capitalize' }]}>{t.status}</Text>}
                            </View>
                        );
                    })}
                </View>

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) =>
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                } />
            </Page>
        </Document>
    );
}
