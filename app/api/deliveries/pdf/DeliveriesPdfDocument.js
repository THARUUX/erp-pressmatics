import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        padding: 24,
        fontFamily: 'Helvetica',
        fontSize: 8,
        color: '#1f2937'
    },
    headerRow: {
        flexDirection: 'row',
        justify: 'space-between',
        alignItems: 'flex-end',
        borderBottomWidth: 2,
        borderBottomColor: '#0f172a',
        paddingBottom: 8,
        marginBottom: 14
    },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 180 },
    headerTitle: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#0f172a',
        letterSpacing: 0.5
    },
    headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerMeta: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
    
    statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statCell: {
        flex: 1,
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: '6 10',
        borderRadius: 4
    },
    statLabel: {
        fontSize: 7,
        textTransform: 'uppercase',
        color: '#6b7280',
        fontFamily: 'Helvetica-Bold',
        marginBottom: 2
    },
    statValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' },

    table: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 4,
        overflow: 'hidden'
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        padding: '6 8'
    },
    tableHeaderText: {
        fontSize: 7,
        textTransform: 'uppercase',
        color: '#4b5563',
        fontFamily: 'Helvetica-Bold'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#e5e7eb',
        padding: '6 8',
        alignItems: 'center'
    },
    
    tableCell: { fontSize: 7.5, color: '#374151' },
    tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
    
    statusBadge: {
        fontSize: 6.5,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        padding: '2 5',
        borderRadius: 3,
        textAlign: 'center'
    },

    footer: {
        position: 'absolute',
        bottom: 14,
        left: 24,
        right: 24,
        borderTopWidth: 0.5,
        borderTopColor: '#e5e7eb',
        paddingTop: 4,
        textAlign: 'center',
        fontSize: 6.5,
        color: '#9ca3af'
    },
});

export default function DeliveriesPdfDocument({ deliveries, statusFilter = 'All', currency = 'LKR' }) {
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false });

    const totalOrders = deliveries.length;
    const deliveredCount = deliveries.filter(d => d.status === 'Delivered').length;
    const pendingCount = deliveries.filter(d => d.status === 'Pending').length;
    const partialCount = deliveries.filter(d => d.status === 'Partially Delivered').length;

    return (
        <Document title="Deliveries & Dispatch Report" author="Pressmatics ERP">
            <Page size="A4" orientation="landscape" style={styles.page}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>Deliveries & Dispatch Report</Text>
                        <Text style={styles.headerSub}>Filter Status: {statusFilter} • Total Records: {totalOrders}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.headerMeta}>Pressmatics ERP Dispatch</Text>
                        <Text style={[styles.headerSub, { marginTop: 3 }]}>Exported: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats Summary */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCell}>
                        <Text style={styles.statLabel}>Total Orders</Text>
                        <Text style={styles.statValue}>{totalOrders}</Text>
                    </View>
                    <View style={styles.statCell}>
                        <Text style={styles.statLabel}>Pending Delivery</Text>
                        <Text style={[styles.statValue, { color: '#d97706' }]}>{pendingCount}</Text>
                    </View>
                    <View style={styles.statCell}>
                        <Text style={styles.statLabel}>Partially Delivered</Text>
                        <Text style={[styles.statValue, { color: '#2563eb' }]}>{partialCount}</Text>
                    </View>
                    <View style={styles.statCell}>
                        <Text style={styles.statLabel}>Fully Delivered</Text>
                        <Text style={[styles.statValue, { color: '#059669' }]}>{deliveredCount}</Text>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { width: '12%' }]}>SO Code</Text>
                        <Text style={[styles.tableHeaderText, { width: '22%' }]}>Customer</Text>
                        <Text style={[styles.tableHeaderText, { width: '20%' }]}>Item / Job Description</Text>
                        <Text style={[styles.tableHeaderText, { width: '12%' }]}>Delivery Date</Text>
                        <Text style={[styles.tableHeaderText, { width: '14%', textAlign: 'right' }]}>Delivered / Total</Text>
                        <Text style={[styles.tableHeaderText, { width: '10%', textAlign: 'center' }]}>Progress</Text>
                        <Text style={[styles.tableHeaderText, { width: '10%', textAlign: 'center' }]}>Status</Text>
                    </View>

                    {deliveries.length === 0 ? (
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableCell, { width: '100%', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }]}>
                                No delivery orders found
                            </Text>
                        </View>
                    ) : (
                        deliveries.map((item, idx) => {
                            const totalQty = parseInt(item.total_quantity || 0);
                            const delivQty = parseInt(item.delivered_quantity || 0);
                            const pct = totalQty > 0 ? Math.round((delivQty / totalQty) * 100) : 0;
                            const delivDate = item.so_delivery_date
                                ? new Date(item.so_delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—';

                            return (
                                <View key={item.id || idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 1 ? '#f9fafb' : '#ffffff' }]}>
                                    <Text style={[styles.tableCellBold, { width: '12%', color: '#1d4ed8' }]}>{item.sales_order_code || '—'}</Text>
                                    <View style={{ width: '22%' }}>
                                        <Text style={styles.tableCellBold}>{item.customer_name || '—'}</Text>
                                        <Text style={[styles.tableCell, { fontSize: 6.5, color: '#6b7280' }]} numberOfLines={1}>
                                            {item.delivery_address || 'Default Address'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.tableCell, { width: '20%' }]} numberOfLines={1}>{item.estimation_name || item.job_description || '—'}</Text>
                                    <Text style={[styles.tableCell, { width: '12%', color: '#ea580c' }]}>{delivDate}</Text>
                                    <Text style={[styles.tableCell, { width: '14%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                                        {delivQty.toLocaleString()} / {totalQty.toLocaleString()}
                                    </Text>
                                    <Text style={[styles.tableCell, { width: '10%', textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>{pct}%</Text>
                                    <View style={{ width: '10%', alignItems: 'center' }}>
                                        <Text style={[
                                            styles.statusBadge,
                                            item.status === 'Delivered'
                                                ? { backgroundColor: '#dcfce7', color: '#166534' }
                                                : item.status === 'Partially Delivered'
                                                ? { backgroundColor: '#dbeafe', color: '#1e40af' }
                                                : { backgroundColor: '#fef3c7', color: '#92400e' }
                                        ]}>
                                            {item.status || 'Pending'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Footer */}
                <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
                    `Pressmatics ERP Dispatch System • Document Generated: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
