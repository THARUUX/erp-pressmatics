import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 30,
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#111827',
        paddingBottom: 15,
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    subtitle: {
        fontSize: 10,
        color: '#6B7280',
        marginTop: 3,
    },
    metaBadge: {
        backgroundColor: '#F3F4F6',
        padding: 8,
        borderRadius: 6,
        textAlign: 'right',
    },
    metaLabel: {
        fontSize: 8,
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    metaVal: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#111827',
    },
    infoGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    infoCard: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        padding: 10,
    },
    infoTitle: {
        fontSize: 9,
        color: '#4B5563',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#111827',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 4,
    },
    table: {
        width: '100%',
        marginBottom: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        padding: 8,
        borderRadius: 4,
    },
    th: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 8,
        paddingHorizontal: 6,
        alignItems: 'center',
    },
    stopBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#2563EB',
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingTop: 4,
        marginRight: 8,
    },
    colStop: { width: '8%' },
    colSO: { width: '18%' },
    colCustomer: { width: '28%' },
    colItem: { width: '26%' },
    colParcels: { width: '20%', textAlign: 'right' },

    addressText: {
        fontSize: 8,
        color: '#4B5563',
        marginTop: 2,
    },
    footer: {
        position: 'absolute',
        bottom: 25,
        left: 30,
        right: 30,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerText: {
        fontSize: 8,
        color: '#9CA3AF',
    }
});

export function RouteManifestPdfDocument({ route }) {
    const stops = route.stops_data || [];
    const formattedDate = route.route_date ? new Date(route.route_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>DRIVER DELIVERY MANIFEST</Text>
                        <Text style={styles.subtitle}>Daily Route Planning & Stop Dispatch Manifest</Text>
                    </View>
                    <View style={styles.metaBadge}>
                        <Text style={styles.metaLabel}>Route Date</Text>
                        <Text style={styles.metaVal}>{formattedDate}</Text>
                    </View>
                </View>

                {/* Summary Cards */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>Route Name</Text>
                        <Text style={styles.infoValue}>{route.route_name}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>Driver Name</Text>
                        <Text style={styles.infoValue}>{route.driver_name || 'Unassigned'}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>Vehicle No.</Text>
                        <Text style={styles.infoValue}>{route.vehicle_no || 'Unassigned'}</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>Total Stops / Est. Distance</Text>
                        <Text style={styles.infoValue}>{stops.length} Stops · {route.total_distance_km || 0} km</Text>
                    </View>
                </View>

                {/* Depot Start Location */}
                <View style={{ marginBottom: 15, padding: 8, backgroundColor: '#EFF6FF', borderRadius: 4, borderWidth: 1, borderColor: '#BFDBFE' }}>
                    <Text style={{ fontSize: 9, color: '#1E40AF', fontWeight: 'bold' }}>STARTING DEPOT LOCATION</Text>
                    <Text style={{ fontSize: 10, color: '#1E3A8A', marginTop: 2 }}>{route.depot_address || 'Colombo Depot, Sri Lanka'}</Text>
                </View>

                {/* Delivery Stops Table */}
                <Text style={styles.sectionTitle}>DELIVERY STOP SEQUENCE</Text>
                
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, styles.colStop]}>Stop</Text>
                        <Text style={[styles.th, styles.colSO]}>SO Code</Text>
                        <Text style={[styles.th, styles.colCustomer]}>Customer & Address</Text>
                        <Text style={[styles.th, styles.colItem]}>Item Description</Text>
                        <Text style={[styles.th, styles.colParcels]}>Parcels / Qty</Text>
                    </View>

                    {stops.map((stop, idx) => {
                        const parcels = Math.ceil((stop.total_quantity || 1) / (stop.books_per_parcel || 50));
                        return (
                            <View key={idx} style={styles.tableRow} wrap={false}>
                                <View style={styles.colStop}>
                                    <Text style={styles.stopBadge}>{idx + 1}</Text>
                                </View>
                                <View style={styles.colSO}>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1D4ED8' }}>{stop.sales_order_code}</Text>
                                    <Text style={{ fontSize: 8, color: '#6B7280' }}>{stop.sales_order_status || 'Ready'}</Text>
                                </View>
                                <View style={styles.colCustomer}>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111827' }}>{stop.customer_name}</Text>
                                    <Text style={styles.addressText}>{stop.delivery_address || 'Default Address'}</Text>
                                </View>
                                <View style={styles.colItem}>
                                    <Text style={{ fontSize: 9, color: '#374151' }}>{stop.estimation_name}</Text>
                                </View>
                                <View style={styles.colParcels}>
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#059669' }}>{parcels} Parcels</Text>
                                    <Text style={{ fontSize: 8, color: '#6B7280' }}>{stop.total_quantity} units</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Driver Signature / Notes */}
                <View style={{ marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ width: '45%', borderTopWidth: 1, borderTopColor: '#9CA3AF', paddingTop: 6 }}>
                        <Text style={{ fontSize: 9, color: '#4B5563', fontWeight: 'bold' }}>Driver Signature</Text>
                    </View>
                    <View style={{ width: '45%', borderTopWidth: 1, borderTopColor: '#9CA3AF', paddingTop: 6 }}>
                        <Text style={{ fontSize: 9, color: '#4B5563', fontWeight: 'bold' }}>Dispatcher Signature</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>ERP Pressmatics — Automated Delivery Route Management</Text>
                    <Text style={styles.footerText}>Generated: {new Date().toLocaleString()}</Text>
                </View>
            </Page>
        </Document>
    );
}
