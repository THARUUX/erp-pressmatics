import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        padding: 20,
        fontFamily: 'Helvetica',
        fontSize: 8,
        color: '#1e293b'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#0f172a',
        paddingBottom: 8,
        marginBottom: 12
    },
    companyDetails: {
        flex: 1
    },
    companyName: {
        fontSize: 13,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    companySubText: {
        fontSize: 7,
        color: '#64748b',
        marginTop: 1
    },
    titleSection: {
        alignItems: 'flex-end',
        width: 150
    },
    title: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        letterSpacing: 0.5
    },
    docNumber: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: '#2563eb',
        marginTop: 2
    },
    gridRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12
    },
    infoBlock: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 4,
        padding: 8,
        borderWidth: 0.5,
        borderColor: '#e2e8f0'
    },
    blockTitle: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#64748b',
        letterSpacing: 0.5,
        marginBottom: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: '#cbd5e1',
        paddingBottom: 1
    },
    infoText: {
        fontSize: 8,
        color: '#334155',
        marginBottom: 2
    },
    infoLabel: {
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a'
    },
    tableHeader: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderTopColor: '#0f172a',
        borderBottomColor: '#0f172a',
        paddingVertical: 4,
        backgroundColor: '#f8fafc',
        marginTop: 2
    },
    tableHeaderText: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#0f172a'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 5,
        alignItems: 'center'
    },
    tableCell: {
        fontSize: 8,
        color: '#334155'
    },
    tableCellBold: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a'
    },
    colDesc: { flex: 3 },
    colQty: { flex: 1, textAlign: 'center' },
    colShip: { flex: 1.2, textAlign: 'center' },
    colBox: { flex: 1, textAlign: 'center' },
    colRatio: { flex: 1, textAlign: 'right' },
    
    notesSection: {
        marginTop: 10,
        padding: 6,
        backgroundColor: '#fef3c7',
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#fde68a'
    },
    notesTitle: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#b45309',
        marginBottom: 2
    },
    notesText: {
        fontSize: 7.5,
        color: '#78350f',
        fontStyle: 'italic'
    },
    signoffRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 25
    },
    signoffBox: {
        width: 160,
        borderTopWidth: 1,
        borderTopColor: '#0f172a',
        paddingTop: 4,
        alignItems: 'center'
    },
    signoffText: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#64748b'
    },
    footer: {
        position: 'absolute',
        bottom: 12,
        left: 20,
        right: 20,
        borderTopWidth: 0.5,
        borderTopColor: '#cbd5e1',
        paddingTop: 4,
        textAlign: 'center',
        fontSize: 6.5,
        color: '#94a3b8'
    }
});

export default function DeliveryNoteDocument({ dispatch, delivery, salesOrder, customer, settings }) {
    const dispatchDateStr = dispatch.dispatched_at 
        ? new Date(dispatch.dispatched_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        
    const companyName = settings.company_name || 'Pressmatics ERP';
    const companyAddress = settings.company_address || '';
    const companyPhone = settings.company_phone || '';
    const companyEmail = settings.company_email || '';

    return (
        <Document title={`DeliveryNote-${salesOrder?.code || 'DN'}-${dispatch.id || 'Draft'}`} author="Pressmatics ERP">
            <Page size="A5" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.companyDetails}>
                        <Text style={s.companyName}>{companyName}</Text>
                        {companyAddress ? <Text style={s.companySubText}>{companyAddress}</Text> : null}
                        {companyPhone || companyEmail ? (
                            <Text style={s.companySubText}>
                                {companyPhone ? `Tel: ${companyPhone}` : ''}
                                {companyPhone && companyEmail ? '  |  ' : ''}
                                {companyEmail ? `Email: ${companyEmail}` : ''}
                            </Text>
                        ) : null}
                    </View>
                    <View style={s.titleSection}>
                        <Text style={s.title}>DELIVERY NOTE</Text>
                        <Text style={s.docNumber}>{dispatch.id ? `DN-${String(dispatch.id).padStart(5, '0')}` : 'DRAFT'}</Text>
                    </View>
                </View>

                {/* Info Blocks Grid */}
                <View style={s.gridRow}>
                    {/* Delivery / Shipping Info */}
                    <View style={s.infoBlock}>
                        <Text style={s.blockTitle}>Delivery To</Text>
                        <Text style={[s.infoText, s.infoLabel, { fontSize: 8.5 }]}>{customer.name}</Text>
                        {customer.address ? (
                            <Text style={[s.infoText, { marginTop: 2, lineHeight: 1.2, fontSize: 7.5 }]}>{customer.address}</Text>
                        ) : (
                            <Text style={[s.infoText, { color: '#94a3b8', fontStyle: 'italic' }]}>No delivery address recorded</Text>
                        )}
                        {customer.phone ? <Text style={s.infoText}><Text style={s.infoLabel}>Phone: </Text>{customer.phone}</Text> : null}
                    </View>

                    {/* Shipment Meta Details */}
                    <View style={s.infoBlock}>
                        <Text style={s.blockTitle}>Shipment Reference</Text>
                        <Text style={s.infoText}>
                            <Text style={s.infoLabel}>Sales Order: </Text>{salesOrder?.code || delivery.sales_order_code || '—'}
                        </Text>
                        <Text style={s.infoText}>
                            <Text style={s.infoLabel}>Dispatch Date: </Text>{dispatchDateStr}
                        </Text>
                        <Text style={s.infoText}>
                            <Text style={s.infoLabel}>Carrier / Driver: </Text>{dispatch.carrier_name || '—'}
                        </Text>
                        <Text style={s.infoText}>
                            <Text style={s.infoLabel}>Waybill / Tracking: </Text>{dispatch.tracking_number || '—'}
                        </Text>
                    </View>
                </View>

                {/* Items Table */}
                <View style={s.tableHeader}>
                    <Text style={[s.tableHeaderText, s.colDesc, { paddingLeft: 4 }]}>Item Name / Description</Text>
                    <Text style={[s.tableHeaderText, s.colQty]}>Total Ordered</Text>
                    <Text style={[s.tableHeaderText, s.colShip]}>Shipped Qty</Text>
                    <Text style={[s.tableHeaderText, s.colBox]}>No. of Boxes</Text>
                    <Text style={[s.tableHeaderText, s.colRatio, { paddingRight: 4 }]}>Packing Ratio</Text>
                </View>

                <View style={s.tableRow}>
                    <Text style={[s.tableCellBold, s.colDesc, { paddingLeft: 4 }]}>{delivery.estimation_name}</Text>
                    <Text style={[s.tableCell, s.colQty]}>{delivery.total_quantity?.toLocaleString()}</Text>
                    <Text style={[s.tableCellBold, s.colShip, { color: '#059669' }]}>{dispatch.dispatched_quantity?.toLocaleString()}</Text>
                    <Text style={[s.tableCell, s.colBox]}>{dispatch.parcels_count || '—'}</Text>
                    <Text style={[s.tableCell, s.colRatio, { paddingRight: 4 }]}>{delivery.books_per_parcel || 50} / box</Text>
                </View>

                {/* Notes */}
                {dispatch.notes ? (
                    <View style={s.notesSection}>
                        <Text style={s.notesTitle}>Dispatch Notes / Special Instructions</Text>
                        <Text style={s.notesText}>{dispatch.notes}</Text>
                    </View>
                ) : null}

                {/* Sign-offs */}
                <View style={s.signoffRow}>
                    <View style={s.signoffBox}>
                        <Text style={s.signoffText}>Dispatched By (Sign &amp; Date)</Text>
                    </View>
                    <View style={s.signoffBox}>
                        <Text style={s.signoffText}>Received in Good Order (Customer)</Text>
                    </View>
                </View>

                {/* Footer */}
                <Text style={s.footer}>
                    Thank you for your business! Auto-Generated via Pressmatics Cloud ERP.
                </Text>
            </Page>
        </Document>
    );
}
