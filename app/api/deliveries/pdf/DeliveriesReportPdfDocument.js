import React from 'react';
import {
    Document, Page, View, Text, StyleSheet
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        padding: 24,
        fontFamily: 'Helvetica',
        fontSize: 8.5,
        color: '#1f2937'
    },
    headerRow: {
        flexDirection: 'row',
        justify: 'space-between',
        alignItems: 'flex-end',
        borderBottomWidth: 2,
        borderBottomColor: '#059669',
        paddingBottom: 8,
        marginBottom: 14
    },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 220 },
    headerTitle: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#0f172a',
        letterSpacing: 0.5
    },
    headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerDate: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#059669' },

    // Summary Cards Grid
    statsGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14
    },
    statCard: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 5,
        padding: '6 10'
    },
    statLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
    statValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 },
    statSub: { fontSize: 7, color: '#059669', marginTop: 1 },

    // Table Styles
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        marginBottom: 6,
        textTransform: 'uppercase'
    },
    table: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 16
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#cbd5e1',
        padding: '5 6'
    },
    tableHeaderText: {
        fontSize: 7,
        textTransform: 'uppercase',
        color: '#475569',
        fontFamily: 'Helvetica-Bold'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#f1f5f9',
        padding: '5 6',
        alignItems: 'center'
    },
    tableRowAlt: { backgroundColor: '#fafafa' },
    tableCell: { fontSize: 7.5, color: '#334155' },
    tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    tableCellRight: { textAlign: 'right' },
    tableCellCenter: { textAlign: 'center' },

    // Badges
    badge: {
        padding: '2 4',
        borderRadius: 2,
        fontSize: 6.5,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        textAlign: 'center'
    },
    badge_delivered: { backgroundColor: '#dcfce7', color: '#15803d' },
    badge_partial: { backgroundColor: '#dbeafe', color: '#1d4ed8' },
    badge_pending: { backgroundColor: '#fef3c7', color: '#b45309' },

    // Dispatch Log Sub-table
    dispatchBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 4,
        padding: 8,
        marginTop: 10
    },
    dispatchTitle: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        marginBottom: 4
    },
    dispatchRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 3,
        fontSize: 7.5
    },

    footer: {
        position: 'absolute',
        bottom: 14,
        left: 24,
        right: 24,
        borderTopWidth: 0.5,
        borderTopColor: '#e2e8f0',
        paddingTop: 4,
        textAlign: 'center',
        fontSize: 6.5,
        color: '#94a3b8'
    }
});

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

export default function DeliveriesReportPdfDocument({ deliveries = [], stats = {}, filterStatus = 'All' }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const issueDate = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });

    const totalOrders = deliveries.length;
    const totalOrdered = stats.totalOrdered || deliveries.reduce((sum, d) => sum + Number(d.total_quantity || 0), 0);
    const totalDelivered = stats.totalDelivered || deliveries.reduce((sum, d) => sum + Number(d.delivered_quantity || 0), 0);
    const totalRemaining = Math.max(0, totalOrdered - totalDelivered);
    const totalParcels = stats.totalParcels || 0;
    const pctDelivered = totalOrdered > 0 ? Math.round((totalDelivered / totalOrdered) * 100) : 0;

    // Collect all dispatches from all deliveries
    const allDispatches = [];
    deliveries.forEach(d => {
        if (d.dispatches && Array.isArray(d.dispatches)) {
            d.dispatches.forEach(disp => {
                allDispatches.push({
                    ...disp,
                    sales_order_code: d.sales_order_code,
                    customer_name: d.customer_name,
                    estimation_name: d.estimation_name
                });
            });
        }
    });

    return (
        <Document title="Deliveries & Dispatch Summary Report" author="Pressmatics ERP">
            <Page size="A4" orientation="landscape" style={styles.page}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>Deliveries &amp; Dispatch Master Report</Text>
                        <Text style={styles.headerSub}>Pressmatics ERP • Delivery Queue, Parcels &amp; Shipment Tracking</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.headerDate}>Status Filter: {filterStatus}</Text>
                        <Text style={[styles.headerSub, { marginTop: 3 }]}>Generated: {issueDate} {timestamp}</Text>
                    </View>
                </View>

                {/* Key Metrics Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Delivery Orders</Text>
                        <Text style={styles.statValue}>{totalOrders}</Text>
                        <Text style={styles.statSub}>{pctDelivered}% Overall Fulfillment</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Quantity Ordered</Text>
                        <Text style={styles.statValue}>{totalOrdered.toLocaleString()}</Text>
                        <Text style={styles.statSub}>Across active queue</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Quantity Delivered</Text>
                        <Text style={[styles.statValue, { color: '#059669' }]}>{totalDelivered.toLocaleString()}</Text>
                        <Text style={styles.statSub}>Completed shipments</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Pending Balance</Text>
                        <Text style={[styles.statValue, { color: '#d97706' }]}>{totalRemaining.toLocaleString()}</Text>
                        <Text style={styles.statSub}>Remaining to dispatch</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Dispatched Parcels</Text>
                        <Text style={[styles.statValue, { color: '#2563eb' }]}>{totalParcels.toLocaleString()}</Text>
                        <Text style={styles.statSub}>{allDispatches.length} Shipments Logged</Text>
                    </View>
                </View>

                {/* Main Deliveries Queue Table */}
                <Text style={styles.sectionTitle}>Active Delivery Queue ({deliveries.length} Items)</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { width: '12%' }]}>SO Code</Text>
                        <Text style={[styles.tableHeaderText, { width: '22%' }]}>Customer Name</Text>
                        <Text style={[styles.tableHeaderText, { width: '22%' }]}>Item / Description</Text>
                        <Text style={[styles.tableHeaderText, { width: '10%' }]}>Target Date</Text>
                        <Text style={[styles.tableHeaderText, { width: '8%', textAlign: 'right' }]}>Total Qty</Text>
                        <Text style={[styles.tableHeaderText, { width: '8%', textAlign: 'right' }]}>Delivered</Text>
                        <Text style={[styles.tableHeaderText, { width: '8%', textAlign: 'right' }]}>Balance</Text>
                        <Text style={[styles.tableHeaderText, { width: '10%', textAlign: 'center' }]}>Status</Text>
                    </View>

                    {deliveries.length === 0 ? (
                        <View style={[styles.tableRow, { justifyContent: 'center', padding: 12 }]}>
                            <Text style={{ fontSize: 8, color: '#94a3b8' }}>No delivery items match the specified criteria.</Text>
                        </View>
                    ) : (
                        deliveries.map((item, idx) => {
                            const isAlt = idx % 2 === 1;
                            const totalQty = Number(item.total_quantity || 0);
                            const delQty = Number(item.delivered_quantity || 0);
                            const remQty = Math.max(0, totalQty - delQty);
                            
                            let badgeStyle = styles.badge_pending;
                            if (item.status === 'Delivered') badgeStyle = styles.badge_delivered;
                            else if (item.status === 'Partially Delivered') badgeStyle = styles.badge_partial;

                            return (
                                <View key={item.id} style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}>
                                    <Text style={[styles.tableCellBold, { width: '12%', color: '#2563eb' }]}>{item.sales_order_code || '—'}</Text>
                                    <View style={{ width: '22%' }}>
                                        <Text style={styles.tableCellBold} numberOfLines={1}>{item.customer_name || '—'}</Text>
                                        <Text style={[styles.tableCell, { fontSize: 6.5, color: '#64748b' }]} numberOfLines={1}>
                                            {item.delivery_address || 'Default Address'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.tableCell, { width: '22%' }]} numberOfLines={1}>{item.estimation_name || '—'}</Text>
                                    <Text style={[styles.tableCell, { width: '10%' }]}>{formatDate(item.so_delivery_date)}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellRight, { width: '8%' }]}>{totalQty.toLocaleString()}</Text>
                                    <Text style={[styles.tableCellBold, styles.tableCellRight, { width: '8%', color: '#059669' }]}>{delQty.toLocaleString()}</Text>
                                    <Text style={[styles.tableCellBold, styles.tableCellRight, { width: '8%', color: '#d97706' }]}>{remQty.toLocaleString()}</Text>
                                    <View style={{ width: '10%', alignItems: 'center' }}>
                                        <Text style={[styles.badge, badgeStyle]}>{item.status || 'Pending'}</Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Logged Dispatches Table (If any exist) */}
                {allDispatches.length > 0 && (
                    <View wrap={false} style={{ marginTop: 6 }}>
                        <Text style={styles.sectionTitle}>Recent Dispatched Shipments History ({allDispatches.length} Shipments)</Text>
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { width: '14%' }]}>Dispatch Date</Text>
                                <Text style={[styles.tableHeaderText, { width: '12%' }]}>SO Code</Text>
                                <Text style={[styles.tableHeaderText, { width: '22%' }]}>Customer</Text>
                                <Text style={[styles.tableHeaderText, { width: '18%' }]}>Carrier / Vehicle</Text>
                                <Text style={[styles.tableHeaderText, { width: '14%' }]}>Tracking / Ref</Text>
                                <Text style={[styles.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Parcels</Text>
                                <Text style={[styles.tableHeaderText, { width: '10%', textAlign: 'right' }]}>Qty Sent</Text>
                            </View>

                            {allDispatches.slice(0, 15).map((disp, idx) => {
                                const isAlt = idx % 2 === 1;
                                return (
                                    <View key={disp.id || idx} style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}>
                                        <Text style={[styles.tableCell, { width: '14%' }]}>{formatDate(disp.dispatched_at)}</Text>
                                        <Text style={[styles.tableCellBold, { width: '12%', color: '#2563eb' }]}>{disp.sales_order_code || '—'}</Text>
                                        <Text style={[styles.tableCell, { width: '22%' }]} numberOfLines={1}>{disp.customer_name || '—'}</Text>
                                        <Text style={[styles.tableCell, { width: '18%' }]} numberOfLines={1}>{disp.carrier_name || 'Direct Delivery'}</Text>
                                        <Text style={[styles.tableCell, { width: '14%' }]} numberOfLines={1}>{disp.tracking_number || '—'}</Text>
                                        <Text style={[styles.tableCellBold, styles.tableCellRight, { width: '10%' }]}>{disp.parcels_count || 1}</Text>
                                        <Text style={[styles.tableCellBold, styles.tableCellRight, { width: '10%', color: '#059669' }]}>
                                            {Number(disp.dispatched_quantity || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Footer */}
                <Text
                    style={styles.footer}
                    render={({ pageNumber, totalPages }) => (
                        `Pressmatics Cloud ERP • Deliveries & Dispatch Summary Report • Generated: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                    )}
                />
            </Page>
        </Document>
    );
}
