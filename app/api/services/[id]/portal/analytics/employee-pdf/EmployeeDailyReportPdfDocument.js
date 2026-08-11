import React from 'react';
import {
    Document, Page, View, Text, StyleSheet
} from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 8.5, color: '#1f2937' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#6366f1', paddingBottom: 8, marginBottom: 16 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 200 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', letterSpacing: 0.5 },
    headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerDate: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#4338ca' },

    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    statCell: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: '8 10', borderRadius: 4 },
    statLabel: { fontSize: 7, textTransform: 'uppercase', color: '#64748b', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    statValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    statSub: { fontSize: 7, color: '#64748b', marginTop: 1 },

    sectionTitleRow: { backgroundColor: '#f1f5f9', padding: '5 8', borderLeftWidth: 3, borderLeftColor: '#6366f1', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a', textTransform: 'uppercase' },

    table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', padding: '6 8' },
    tableHeaderText: { fontSize: 7, textTransform: 'uppercase', color: '#475569', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', padding: '6 8', alignItems: 'center' },
    tableRowAlt: { backgroundColor: '#fafafa' },

    tableCell: { fontSize: 7.5, color: '#334155' },
    tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    tableCellRight: { textAlign: 'right' },
    tableCellCenter: { textAlign: 'center' },

    badge: { padding: '2 4', borderRadius: 2, fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'center' },
    badgePositive: { backgroundColor: '#dcfce7', color: '#15803d' },
    badgeNegative: { backgroundColor: '#ffe4e6', color: '#be123c' },

    footer: { position: 'absolute', bottom: 14, left: 24, right: 24, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#94a3b8' },
});

export default function EmployeeDailyReportPdfDocument({ serviceName, periodType, totals, employees, periodMatrix, uniquePeriods }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const issueDate = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });

    return (
        <Document title={`Employee-Production-Report-${periodType}`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>Employee Daily Production &amp; Revenue Report</Text>
                        <Text style={s.headerSub}>{serviceName || 'Services Portal'} • Breakdown by Worked Hours, Labor Value &amp; Sales Order Revenue</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerDate}>Period: {periodType.toUpperCase()}</Text>
                        <Text style={[s.headerSub, { marginTop: 3 }]}>Generated: {issueDate} {timestamp}</Text>
                    </View>
                </View>

                {/* Overall KPI Summary */}
                <View style={s.statsGrid}>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Total Active Staff</Text>
                        <Text style={s.statValue}>{employees.length} Technicians</Text>
                        <Text style={s.statSub}>Configured in service team</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Total Logged Hours</Text>
                        <Text style={s.statValue}>{totals.totalHrs} Hours</Text>
                        <Text style={s.statSub}>Tracked across task work logs</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Contributed Labor Value</Text>
                        <Text style={s.statValue}>LKR {totals.totalLaborVal.toLocaleString()}</Text>
                        <Text style={s.statSub}>Calculated as (worked hrs × rate)</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Sales Order Revenue Share</Text>
                        <Text style={s.statValue}>LKR {totals.totalSoRev.toLocaleString()}</Text>
                        <Text style={s.statSub}>Pro-rated sales order revenue</Text>
                    </View>
                </View>

                {/* Employee Performance Summary Table */}
                <View style={s.sectionTitleRow}>
                    <Text style={s.sectionTitle}>Employee Summary &amp; Labor Contribution</Text>
                </View>

                <View style={s.table}>
                    <View style={s.tableHeader}>
                        <Text style={[s.tableHeaderText, { width: '22%' }]}>Employee Name &amp; Role</Text>
                        <Text style={[s.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Pay Rate</Text>
                        <Text style={[s.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Worked Hrs</Text>
                        <Text style={[s.tableHeaderText, { width: '18%', textAlign: 'right' }]}>Labor Value (hr × rate)</Text>
                        <Text style={[s.tableHeaderText, { width: '18%', textAlign: 'right' }]}>SO Revenue Share</Text>
                        <Text style={[s.tableHeaderText, { width: '12%', textAlign: 'right' }]}>Net Margin</Text>
                        <Text style={[s.tableHeaderText, { width: '8%', textAlign: 'center' }]}>Efficiency</Text>
                    </View>

                    {employees.length === 0 ? (
                        <View style={{ padding: 12, alignItems: 'center' }}>
                            <Text style={{ fontSize: 8, color: '#94a3b8' }}>No employee logs recorded.</Text>
                        </View>
                    ) : (
                        employees.map((emp, idx) => {
                            const isAlt = idx % 2 === 1;
                            const marginPos = emp.grossMargin >= 0;
                            return (
                                <View key={emp.name} style={[s.tableRow, isAlt ? s.tableRowAlt : {}]}>
                                    <View style={{ width: '22%' }}>
                                        <Text style={s.tableCellBold}>{emp.name}</Text>
                                        <Text style={[s.tableCell, { fontSize: 6.5, color: '#64748b' }]}>{emp.role}</Text>
                                    </View>
                                    <Text style={[s.tableCell, s.tableCellRight, { width: '10%' }]}>
                                        LKR {emp.hourlyRate}/hr
                                    </Text>
                                    <Text style={[s.tableCellBold, s.tableCellRight, { width: '12%' }]}>
                                        {emp.loggedHours} hrs
                                    </Text>
                                    <Text style={[s.tableCellBold, s.tableCellRight, { width: '18%', color: '#4338ca' }]}>
                                        LKR {emp.laborValue.toLocaleString()}
                                    </Text>
                                    <Text style={[s.tableCellBold, s.tableCellRight, { width: '18%', color: '#15803d' }]}>
                                        LKR {emp.soRevenueValue.toLocaleString()}
                                    </Text>
                                    <Text style={[s.tableCellBold, s.tableCellRight, { width: '12%', color: marginPos ? '#0891b2' : '#e11d48' }]}>
                                        LKR {emp.grossMargin.toLocaleString()}
                                    </Text>
                                    <Text style={[s.tableCell, s.tableCellCenter, { width: '8%' }]}>
                                        {emp.efficiencyPct != null ? `${emp.efficiencyPct}%` : '—'}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Period Breakdown Matrix (Day by Day / Weekly / Monthly Matrix) */}
                {uniquePeriods.length > 0 && (
                    <View wrap={false}>
                        <View style={s.sectionTitleRow}>
                            <Text style={s.sectionTitle}>Period Log Breakdown ({periodType.toUpperCase()})</Text>
                        </View>

                        <View style={s.table}>
                            <View style={s.tableHeader}>
                                <Text style={[s.tableHeaderText, { width: '20%' }]}>Employee</Text>
                                {uniquePeriods.slice(0, 8).map(pKey => (
                                    <Text key={pKey} style={[s.tableHeaderText, { flex: 1, textAlign: 'center' }]}>
                                        {pKey}
                                    </Text>
                                ))}
                                <Text style={[s.tableHeaderText, { width: '15%', textAlign: 'right' }]}>Total Worked</Text>
                            </View>

                            {employees.map((emp, idx) => {
                                const isAlt = idx % 2 === 1;
                                return (
                                    <View key={emp.name} style={[s.tableRow, isAlt ? s.tableRowAlt : {}]}>
                                        <Text style={[s.tableCellBold, { width: '20%' }]}>{emp.name}</Text>
                                        {uniquePeriods.slice(0, 8).map(pKey => {
                                            const pData = periodMatrix[pKey]?.[emp.name];
                                            if (!pData || pData.hours === 0) {
                                                return (
                                                    <Text key={pKey} style={[s.tableCell, s.tableCellCenter, { flex: 1, color: '#cbd5e1' }]}>
                                                        —
                                                    </Text>
                                                );
                                            }
                                            const hrs = Math.round(pData.hours * 10) / 10;
                                            return (
                                                <Text key={pKey} style={[s.tableCellBold, s.tableCellCenter, { flex: 1, color: '#334155' }]}>
                                                    {hrs}h
                                                </Text>
                                            );
                                        })}
                                        <Text style={[s.tableCellBold, s.tableCellRight, { width: '15%', color: '#4338ca' }]}>
                                            {emp.loggedHours}h (LKR {emp.laborValue.toLocaleString()})
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Pressmatics Cloud ERP • Employee Daily Production Report • Generated: ${issueDate} ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
