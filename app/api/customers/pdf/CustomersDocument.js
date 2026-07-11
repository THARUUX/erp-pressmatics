import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 8, color: '#1f2937' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 16 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 180 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', letterSpacing: 0.5 },
    headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerRange: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4b5563' },
    
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statCell: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', padding: '8 12', borderRadius: 4 },
    statLabel: { fontSize: 7, textTransform: 'uppercase', color: '#6b7280', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    statValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827' },

    table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', padding: '6 8' },
    tableHeaderText: { fontSize: 7, textTransform: 'uppercase', color: '#4b5563', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', padding: '6 8', alignItems: 'center' },
    
    tableCell: { fontSize: 7.5, color: '#374151' },
    tableCellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
    
    footer: { position: 'absolute', bottom: 14, left: 24, right: 24, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#9ca3af' },
});

// Dynamic column weights
const columnWeights = {
    code: 1.0,
    name: 2.2,
    category: 1.2,
    email: 2.0,
    phone: 1.2,
    address: 2.5,
    is_vat: 1.0,
    outstanding: 1.5,
};

export default function CustomersDocument({ columns, rows, currency }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });

    // Calculate column widths based on weights
    const totalWeight = columns.reduce((sum, col) => sum + (columnWeights[col.key] || 1.5), 0);
    const getColWidth = (key) => {
        const weight = columnWeights[key] || 1.5;
        return `${((weight / totalWeight) * 100).toFixed(1)}%`;
    };

    // Calculate stats
    const totalCustomers = rows.length;
    const vatCustomers = rows.filter(r => r.is_vat === 1).length;
    const totalOutstanding = rows.reduce((sum, r) => sum + parseFloat(r.outstanding || 0), 0);

    return (
        <Document title="Customers Report" author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>Customers Directory Report</Text>
                        <Text style={s.headerSub}>Exported Customer List (Customized & Filtered)</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerRange}>{totalCustomers} Clients Listed</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={s.statsGrid}>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Total Clients</Text>
                        <Text style={s.statValue}>{totalCustomers}</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>VAT Registered</Text>
                        <Text style={s.statValue}>{vatCustomers} Clients</Text>
                    </View>
                    <View style={s.statCell}>
                        <Text style={s.statLabel}>Total Outstanding Balance</Text>
                        <Text style={s.statValue}>
                            {currency} {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                    </View>
                </View>

                {/* Table */}
                <View style={s.table}>
                    {/* Header Row */}
                    <View style={s.tableHeader}>
                        {columns.map(col => {
                            const isRight = col.key === 'outstanding';
                            return (
                                <Text key={col.key} style={[
                                    s.tableHeaderText, 
                                    { width: getColWidth(col.key), textAlign: isRight ? 'right' : 'left' }
                                ]}>
                                    {col.header}
                                </Text>
                            );
                        })}
                    </View>

                    {/* Data Rows */}
                    {rows.length === 0 ? (
                        <View style={s.tableRow}>
                            <Text style={[s.tableCell, { color: '#9ca3af', fontStyle: 'italic', width: '100%', textAlign: 'center' }]}>
                                No records match the current filter
                            </Text>
                        </View>
                    ) : (
                        rows.map((row, idx) => (
                            <View key={row.id || idx} style={[
                                s.tableRow,
                                { backgroundColor: idx % 2 === 1 ? '#f9fafb' : '#ffffff' }
                            ]}>
                                {columns.map(col => {
                                    const isRight = col.key === 'outstanding';
                                    const val = row[col.key];

                                    // Custom cell rendering inside PDF
                                    let displayVal = val;
                                    if (col.key === 'outstanding') {
                                        const amount = parseFloat(val || 0);
                                        displayVal = `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    } else if (col.key === 'is_vat') {
                                        displayVal = val === 1 ? 'VAT' : 'Non VAT';
                                    } else if (col.key === 'code') {
                                        displayVal = val || `#${row.id}`;
                                    } else if (val === null || val === undefined || val === '') {
                                        displayVal = '—';
                                    }

                                    return (
                                        <Text key={col.key} style={[
                                            col.key === 'name' || col.key === 'code' ? s.tableCellBold : s.tableCell,
                                            { 
                                                width: getColWidth(col.key), 
                                                textAlign: isRight ? 'right' : 'left',
                                                color: col.key === 'outstanding' && parseFloat(val || 0) > 0 ? '#b45309' : '#374151'
                                            }
                                        ]}>
                                            {String(displayVal)}
                                        </Text>
                                    );
                                })}
                            </View>
                        ))
                    )}
                </View>

                {/* Footer */}
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}
