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

    table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: '6 8' },
    tableHeaderText: { fontSize: 7.5, textTransform: 'uppercase', color: '#4b5563', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '6 8', alignItems: 'center' },
    
    orderCard: { border: '1px solid #e2e8f0', borderRadius: 4, marginBottom: 12, overflow: 'hidden' },
    orderHeader: { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: '6 8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    orderMeta: { fontSize: 8, color: '#475569', fontFamily: 'Helvetica-Bold' },
    
    notesBox: { backgroundColor: '#fffbeb', borderLeftWidth: 3, borderLeftColor: '#d97706', padding: '5 8', margin: '4 8 4 8', borderRadius: 2 },
    notesText: { fontSize: 8, color: '#92400e', fontFamily: 'Helvetica-Bold' },
    
    specsBox: { backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: '#3b82f6', padding: '5 8', margin: '4 8 4 8', borderRadius: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    specsItem: { fontSize: 8, color: '#1e3a8a', width: '30%' },
    specsLabel: { fontFamily: 'Helvetica-Bold' },
    
    finishingRow: { backgroundColor: '#f0fdf4', borderLeftWidth: 3, borderLeftColor: '#16a34a', padding: '5 8', margin: '4 8 4 8', borderRadius: 2 },
    finishingText: { fontSize: 8, color: '#14532d', fontFamily: 'Helvetica-Bold' },
    
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

export default function MachineUnplannedPdfDocument({ machine, stats, tasks, options }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    
    // Group by Sales Order helper
    const getGroupedTasks = () => {
        const grouped = {};
        tasks.forEach(t => {
            const key = t.sales_order_id || 'standalone';
            if (!grouped[key]) {
                grouped[key] = {
                    code: t.order_code || (t.sales_order_id ? 'SO-UNKNOWN' : 'STANDALONE'),
                    customer_name: t.customer_name || 'Standalone / Indirect Tasks',
                    delivery_date: t.order_delivery_date || null,
                    job_notes: t.job_notes || '',
                    estimation_names: t.estimation_names || '',
                    tasks: []
                };
            }
            grouped[key].tasks.push(t);
        });
        return Object.values(grouped);
    };

    const groupedData = getGroupedTasks();

    return (
        <Document title={`UnplannedQueue-${machine.name}`} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>Unplanned Production Queue Report</Text>
                        <Text style={s.headerMachine}>{machine.name} • {machine.type.toUpperCase()}</Text>
                        <Text style={s.headerSub}>Detailed Backlog Report</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerRange}>All Unplanned Queue</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={s.statsGrid}>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Total Queue Load</Text>
                        <Text style={s.statValue}>{stats.totalTasks} Tasks</Text>
                        <Text style={s.statSub}>Pending Scheduling</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Total Run Quantity</Text>
                        <Text style={s.statValue}>{stats.totalQty.toLocaleString()}</Text>
                        <Text style={s.statSub}>Total Operations Quantity</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Estimated Time</Text>
                        <Text style={s.statValue}>{stats.totalHours.toFixed(1)} Hrs</Text>
                        <Text style={s.statSub}>Based on Machine Speeds</Text>
                    </View>
                </View>

                {/* Table Content */}
                {options.groupByOrder ? (
                    groupedData.map((group, idx) => (
                        <View key={idx} style={s.orderCard} wrap={false}>
                            {/* Order Header Card */}
                            <View style={s.orderHeader}>
                                <Text style={s.orderTitle}>
                                    {group.code} • {group.customer_name} {group.estimation_names ? `(${group.estimation_names})` : ''}
                                </Text>
                                {options.dates && group.delivery_date && (
                                    <Text style={s.orderMeta}>
                                        Delivery: {new Date(group.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                )}
                            </View>

                            {/* Job Notes if enabled */}
                            {options.notes && group.job_notes ? (
                                <View style={s.notesBox}>
                                    <Text style={s.notesText}>Job Notes / Production Notes: {group.job_notes}</Text>
                                </View>
                            ) : null}

                            {/* Tasks table in this group */}
                            <View style={{ padding: 4 }}>
                                <View style={s.tableHeader}>
                                    <Text style={[s.tableHeaderText, { width: '45%' }]}>Task Name</Text>
                                    <Text style={[s.tableHeaderText, { width: '20%' }]}>Description</Text>
                                    <Text style={[s.tableHeaderText, { width: '15%', textAlign: 'right' }]}>Run Qty</Text>
                                    <Text style={[s.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Est. Time</Text>
                                    <Text style={[s.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Status</Text>
                                </View>
                                {group.tasks.map((t, tIdx) => {
                                    const cleanName = t.name.includes('—')
                                        ? t.name.split('—')[t.name.split('—').length - 1].trim()
                                        : t.name;

                                    return (
                                        <View key={tIdx} style={{ marginBottom: 4 }}>
                                            <View style={s.tableRow}>
                                                <Text style={[s.tableCellBold, { width: '45%' }]}>{cleanName}</Text>
                                                <Text style={[s.tableCell, { width: '20%' }]}>{t.description || '—'}</Text>
                                                <Text style={[s.tableCell, { width: '15%', textAlign: 'right' }]}>{(parseFloat(t.quantity) || 0).toLocaleString()}</Text>
                                                <Text style={[s.tableCell, { width: '10%', textAlign: 'right' }]}>{formatTime(t.estimated_minutes)}</Text>
                                                <Text style={[s.tableCell, { width: '10%', textAlign: 'right', textTransform: 'capitalize' }]}>{t.status}</Text>
                                            </View>

                                            {/* Specs Box if enabled */}
                                            {options.specs && t.componentSpecs ? (
                                                <View style={s.specsBox}>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Paper:</Text> {t.componentSpecs.paper_name || '—'}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Colors:</Text> {t.componentSpecs.colors_front || 0} + {t.componentSpecs.colors_back || 0}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Sides:</Text> {t.componentSpecs.sides === 2 ? 'Double-sided' : 'Single-sided'}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Ups:</Text> {t.componentSpecs.ups || 1} Ups</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Run Sheets:</Text> {t.componentSpecs.printed_sheets ? t.componentSpecs.printed_sheets.toLocaleString() : 0}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Wastage:</Text> {t.componentSpecs.wastage_sheets ? t.componentSpecs.wastage_sheets.toLocaleString() : 0}</Text>
                                                </View>
                                            ) : null}

                                            {/* Finishings if enabled */}
                                            {options.finishings && (t.finishingSpecs || t.globalFinishings?.length > 0) ? (
                                                <View>
                                                    {t.finishingSpecs ? (
                                                        <View style={s.finishingRow}>
                                                            <Text style={s.finishingText}>
                                                                Finishing Operation: {t.finishingSpecs.name} {t.finishingSpecs.machine_name ? `(${t.finishingSpecs.machine_name})` : ''} | Qty: {t.finishingSpecs.quantity ? t.finishingSpecs.quantity.toLocaleString() : '—'}
                                                            </Text>
                                                        </View>
                                                    ) : null}
                                                    {t.globalFinishings?.map((gf, gfIdx) => (
                                                        <View key={gfIdx} style={s.finishingRow}>
                                                            <Text style={s.finishingText}>
                                                                Global Finishing: {gf.name} {gf.machine_name ? `(${gf.machine_name})` : ''} | Qty: {gf.quantity ? gf.quantity.toLocaleString() : '—'}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={s.table}>
                        <View style={s.tableHeader}>
                            <Text style={[s.tableHeaderText, { width: '10%' }]}>Job Code</Text>
                            <Text style={[s.tableHeaderText, { width: '22%' }]}>Customer Name</Text>
                            <Text style={[s.tableHeaderText, { width: '33%' }]}>Task Details</Text>
                            {options.dates && <Text style={[s.tableHeaderText, { width: '12%' }]}>Delivery</Text>}
                            <Text style={[s.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Run Qty</Text>
                            <Text style={[s.tableHeaderText, { width: '7%', textAlign: 'right' }]}>Est. Time</Text>
                            <Text style={[s.tableHeaderText, { width: '6%', textAlign: 'right' }]}>Status</Text>
                        </View>

                        {tasks.map((t, idx) => {
                            const cleanName = t.name.includes('—')
                                ? t.name.split('—')[t.name.split('—').length - 1].trim()
                                : t.name;
                            const hasSubDetails = options.notes && t.job_notes || options.specs && t.componentSpecs || options.finishings && (t.finishingSpecs || t.globalFinishings?.length > 0);

                            return (
                                <View key={idx} wrap={false} style={{ borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' }}>
                                    <View style={s.tableRow}>
                                        <Text style={[s.tableCellBold, { width: '10%' }]}>{t.order_code || 'STANDALONE'}</Text>
                                        <Text style={[s.tableCell, { width: '22%' }]}>{t.customer_name || '—'}</Text>
                                        <Text style={[s.tableCellBold, { width: '33%' }]}>
                                            {cleanName} {t.description ? `(${t.description})` : ''}
                                        </Text>
                                        {options.dates && (
                                            <Text style={[s.tableCell, { width: '12%' }]}>
                                                {t.order_delivery_date ? new Date(t.order_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                            </Text>
                                        )}
                                        <Text style={[s.tableCell, { width: '10%', textAlign: 'right' }]}>{(parseFloat(t.quantity) || 0).toLocaleString()}</Text>
                                        <Text style={[s.tableCell, { width: '7%', textAlign: 'right' }]}>{formatTime(t.estimated_minutes)}</Text>
                                        <Text style={[s.tableCell, { width: '6%', textAlign: 'right', textTransform: 'capitalize' }]}>{t.status}</Text>
                                    </View>

                                    {/* Sub-details (notes, specs, finishings) in a details row under the main row */}
                                    {hasSubDetails ? (
                                        <View style={{ paddingLeft: 12, paddingBottom: 6 }}>
                                            {options.notes && t.job_notes ? (
                                                <View style={s.notesBox}>
                                                    <Text style={s.notesText}>Job Note: {t.job_notes}</Text>
                                                </View>
                                            ) : null}

                                            {options.specs && t.componentSpecs ? (
                                                <View style={s.specsBox}>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Paper:</Text> {t.componentSpecs.paper_name || '—'}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Colors:</Text> {t.componentSpecs.colors_front || 0} + {t.componentSpecs.colors_back || 0}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Sides:</Text> {t.componentSpecs.sides === 2 ? 'Double' : 'Single'}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Ups:</Text> {t.componentSpecs.ups || 1} Ups</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Run Sheets:</Text> {t.componentSpecs.printed_sheets ? t.componentSpecs.printed_sheets.toLocaleString() : 0}</Text>
                                                    <Text style={s.specsItem}><Text style={s.specsLabel}>Wastage:</Text> {t.componentSpecs.wastage_sheets ? t.componentSpecs.wastage_sheets.toLocaleString() : 0}</Text>
                                                </View>
                                            ) : null}

                                            {options.finishings && (t.finishingSpecs || t.globalFinishings?.length > 0) ? (
                                                <View>
                                                    {t.finishingSpecs ? (
                                                        <View style={s.finishingRow}>
                                                            <Text style={s.finishingText}>
                                                                Finishing Operation: {t.finishingSpecs.name} {t.finishingSpecs.machine_name ? `(${t.finishingSpecs.machine_name})` : ''} | Qty: {t.finishingSpecs.quantity ? t.finishingSpecs.quantity.toLocaleString() : '—'}
                                                            </Text>
                                                        </View>
                                                    ) : null}
                                                    {t.globalFinishings?.map((gf, gfIdx) => (
                                                        <View key={gfIdx} style={s.finishingRow}>
                                                            <Text style={s.finishingText}>
                                                                Global Finishing: {gf.name} {gf.machine_name ? `(${gf.machine_name})` : ''} | Qty: {gf.quantity ? gf.quantity.toLocaleString() : '—'}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : null}
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
