import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#1f2937' },
    
    // Header
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#1e293b', paddingBottom: 12, marginBottom: 20 },
    companyInfo: { flex: 1 },
    logo: { height: 40, width: 120, objectFit: 'contain', marginBottom: 6 },
    companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    companyAddress: { fontSize: 8, color: '#6b7280', marginTop: 2, maxW: 240 },
    
    headerRight: { alignItems: 'flex-end', width: 180 },
    docTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1e293b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    metaGrid: { flexDirection: 'row', gap: 12, fontSize: 8.5 },
    metaLabel: { color: '#6b7280', fontFamily: 'Helvetica-Bold' },
    metaVal: { color: '#1f2937' },

    // Billing / Customer info
    billingRow: { marginBottom: 20 },
    billingTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#9ca3af', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 2, marginBottom: 6, width: 80 },
    customerName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827' },
    customerAddress: { fontSize: 8.5, color: '#4b5563', marginTop: 3, maxW: 300 },
    customerContact: { fontSize: 8.5, color: '#6b7280', marginTop: 2 },

    // Table
    table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: '6 8' },
    tableHeaderText: { fontSize: 8, textTransform: 'uppercase', color: '#4b5563', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '8 8', alignItems: 'flex-start' },
    
    tableCell: { fontSize: 8, color: '#374151', lineHeight: 1.3 },
    tableCellBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
    
    // Columns
    colDesc: { width: '45%' },
    colDescNoTax: { width: '60%' },
    colQty: { width: '10%', textAlign: 'center' },
    colPrice: { width: '15%', textAlign: 'right' },
    colTax: { width: '15%', textAlign: 'right' },
    colTotal: { width: '15%', textAlign: 'right' },

    // Summary / Totals
    summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24 },
    summaryGrid: { width: 180, gap: 4 },
    summaryCell: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 8.5 },
    summaryLabel: { color: '#6b7280' },
    summaryVal: { color: '#1f2937', fontFamily: 'Helvetica-Bold' },
    totalDivider: { borderTopWidth: 1, borderTopColor: '#0f172a', paddingTop: 4, marginTop: 4 },

    // Terms
    termsSection: { marginTop: 10 },
    termsTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 },
    termsText: { fontSize: 7.5, color: '#6b7280', lineHeight: 1.3 },

    // Signature
    signatureSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 40 },
    signatureBox: { width: 140, alignItems: 'center' },
    sigImage: { height: 35, width: 100, objectFit: 'contain', marginBottom: 2 },
    sigLine: { borderTopWidth: 1, borderTopColor: '#d1d5db', width: '100%', paddingTop: 4 },
    sigText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#9ca3af' },

    // Footer
    footerText: { position: 'absolute', bottom: 18, left: 36, right: 36, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#9ca3af' }
});

const fmt = (val, cur) => `${cur} ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotationDocument({ quote, settings }) {
    const currency = settings.currency || 'LKR';
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false });
    const subtotal = quote.items ? quote.items.reduce((acc, i) => acc + parseFloat(i.subtotal_amount || i.total_amount || 0), 0) : 0;
    const totalTax = quote.items ? quote.items.reduce((acc, i) => acc + parseFloat(i.tax_amount || 0), 0) : 0;
    const finalTotal = parseFloat(quote.total_amount || 0);
    const hasTax = totalTax !== 0;

    return (
        <Document title={`Quotation-${quote.code || quote.id}`} author="Pressmatics ERP">
            <Page size="A4" orientation="portrait" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.companyInfo}>
                        {settings.company_logo && (
                            <Image src={settings.company_logo} style={s.logo} />
                        )}
                        <Text style={s.companyName}>{settings.company_name || 'Pressmatics ERP'}</Text>
                        <Text style={s.companyAddress}>{settings.company_address || ''}</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.docTitle}>Quotation</Text>
                        <View style={s.metaGrid}>
                            <View>
                                <Text style={s.metaLabel}>Quote No:</Text>
                                <Text style={s.metaLabel}>Date:</Text>
                            </View>
                            <View>
                                <Text style={s.metaVal}>{quote.code || `#${quote.id}`}</Text>
                                <Text style={s.metaVal}>{new Date(quote.created_at).toLocaleDateString('en-GB')}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Customer Info */}
                <View style={s.billingRow}>
                    <Text style={s.billingTitle}>Bill To</Text>
                    <Text style={s.customerName}>{quote.customer_name}</Text>
                    {quote.customer_address && (
                        <Text style={s.customerAddress}>{quote.customer_address}</Text>
                    )}
                    {(quote.customer_phone || quote.customer_email) && (
                        <Text style={s.customerContact}>
                            {quote.customer_phone ? `${quote.customer_phone}  |  ` : ''}{quote.customer_email || ''}
                        </Text>
                    )}
                </View>

                {/* Items Table */}
                <View style={s.table}>
                    <View style={s.tableHeader}>
                        <Text style={[s.tableHeaderText, hasTax ? s.colDesc : s.colDescNoTax]}>Description</Text>
                        <Text style={[s.tableHeaderText, s.colQty]}>Qty</Text>
                        <Text style={[s.tableHeaderText, s.colPrice]}>Unit Price</Text>
                        {hasTax && <Text style={[s.tableHeaderText, s.colTax]}>Tax</Text>}
                        <Text style={[s.tableHeaderText, s.colTotal]}>Net Total</Text>
                    </View>

                    {quote.items && quote.items.map((item, idx) => {
                        const rawSubtotal = parseFloat(item.subtotal_amount || 0);
                        const rawTotal = parseFloat(item.total_amount || 0);
                        const taxVal = parseFloat(item.tax_amount || 0);
                        const itemSubtotal = rawSubtotal > 0 ? rawSubtotal : rawTotal;
                        const unitPrice = item.quantity > 0 ? itemSubtotal / item.quantity : 0;

                        return (
                            <View key={item.id || idx} style={s.tableRow}>
                                <View style={hasTax ? s.colDesc : s.colDescNoTax}>
                                    <Text style={s.tableCellBold}>{item.estimation_name || 'Estimation Item'}</Text>
                                    {item.job_description && (
                                        <Text style={[s.tableCell, { color: '#6b7280', marginTop: 3 }]}>
                                            {item.job_description}
                                        </Text>
                                    )}
                                </View>
                                <Text style={[s.tableCell, s.colQty]}>{item.quantity}</Text>
                                <Text style={[s.tableCell, s.colPrice]}>
                                    {unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                {hasTax && (
                                    <Text style={[s.tableCell, s.colTax]}>
                                        {taxVal !== 0 ? taxVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                    </Text>
                                )}
                                <Text style={[s.tableCell, s.colTotal]}>
                                    {rawTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Totals */}
                <View style={s.summaryRow}>
                    <View style={s.summaryGrid}>
                        {hasTax && (
                            <View style={s.summaryCell}>
                                <Text style={s.summaryLabel}>Subtotal</Text>
                                <Text style={s.summaryVal}>{fmt(subtotal, currency)}</Text>
                            </View>
                        )}
                        {totalTax !== 0 && (
                            <View style={s.summaryCell}>
                                <Text style={s.summaryLabel}>Tax Adjustment</Text>
                                <Text style={s.summaryVal}>{totalTax > 0 ? '+' : ''}{fmt(totalTax, currency)}</Text>
                            </View>
                        )}
                        <View style={[s.summaryCell, s.totalDivider]}>
                            <Text style={[s.summaryLabel, { fontFamily: 'Helvetica-Bold', color: '#0f172a' }]}>Grand Total</Text>
                            <Text style={[s.summaryVal, { fontSize: 11, color: '#1e293b' }]}>{fmt(finalTotal, currency)}</Text>
                        </View>
                    </View>
                </View>

                {/* Terms and Conditions */}
                <View style={s.termsSection}>
                    <Text style={s.termsTitle}>Terms & Conditions</Text>
                    <Text style={s.termsText}>
                        {quote.terms_and_conditions || settings.default_terms || 'No specific terms.'}
                    </Text>
                </View>

                {/* Signature */}
                <View style={s.signatureSection}>
                    <View style={s.signatureBox}>
                        {settings.company_signature && (
                            <Image src={settings.company_signature} style={s.sigImage} />
                        )}
                        <View style={s.sigLine} />
                        <Text style={s.sigText}>Authorized Signature</Text>
                    </View>
                </View>

                {/* Footer */}
                <Text style={s.footerText}>
                    Generated via Pressmatics Cloud ERP • Printed: {timestamp}
                </Text>
            </Page>
        </Document>
    );
}
