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

// Default column weights mapper
const defaultWeights = {
    // General / Customers / Suppliers
    id: 0.8,
    code: 1.0,
    name: 2.2,
    category: 1.2,
    email: 2.0,
    phone: 1.2,
    address: 2.5,
    is_vat: 1.0,
    outstanding: 1.5,
    vat_number: 1.5,

    // Invoices / Quotations / Sales Orders
    customer_name: 2.2,
    supplier_name: 2.2,
    total_amount: 1.8,
    amount_due: 1.6,
    amount_paid: 1.6,
    balance: 1.6,
    status: 1.2,
    quotation_date: 1.6,
    due_date: 1.6,
    created_at: 1.6,
    order_date: 1.6,
    delivery_date: 1.6,

    // Employees / Attendance / Payroll
    employee_code: 1.0,
    employee_name: 2.2,
    date: 1.2,
    check_in: 1.2,
    check_out: 1.2,
    status_label: 1.0,
    net_salary: 1.5,
    basic_salary: 1.5,
    allowances: 1.5,
    deductions: 1.5,

    // Stock Items / Inventory
    item_code: 1.0,
    type: 1.2,
    stock_quantity: 1.3,
    unit_cost: 1.3,
    min_stock: 1.3,
    uom: 1.0,
};

export default function DynamicDocument({ title, subtitle, columns, rows, currency, stats, columnWeights = {} }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });
    const weights = { ...defaultWeights, ...columnWeights };

    const totalWeight = columns.reduce((sum, col) => sum + (weights[col.key] || 1.5), 0);
    const getColWidth = (key) => {
        const weight = weights[key] || 1.5;
        return `${((weight / totalWeight) * 100).toFixed(1)}%`;
    };

    return (
        <Document title={title} author="Pressmatics Cloud ERP">
            <Page size="A4" orientation="landscape" style={s.page}>
                {/* Header */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.headerTitle}>{title}</Text>
                        <Text style={s.headerSub}>{subtitle}</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.headerRange}>{rows.length} Records Listed</Text>
                        <Text style={[s.headerSub, { marginTop: 4 }]}>Issued: {timestamp}</Text>
                    </View>
                </View>

                {/* Stats */}
                {stats && stats.length > 0 && (
                    <View style={s.statsGrid}>
                        {stats.map((stat, idx) => (
                            <View key={idx} style={s.statCell}>
                                <Text style={s.statLabel}>{stat.label}</Text>
                                <Text style={s.statValue}>{stat.value}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Table */}
                <View style={s.table}>
                    {/* Header Row */}
                    <View style={s.tableHeader}>
                        {columns.map(col => {
                            const isRight = ['total_amount', 'amount_due', 'amount_paid', 'balance', 'outstanding', 'net_salary', 'basic_salary', 'allowances', 'deductions', 'stock_quantity', 'unit_cost', 'min_stock'].includes(col.key);
                            return (
                                <View key={col.key} style={{ width: getColWidth(col.key), paddingHorizontal: 6 }}>
                                    <Text style={[
                                        s.tableHeaderText,
                                        { textAlign: isRight ? 'right' : 'left', width: '100%' }
                                    ]}>
                                        {col.header}
                                    </Text>
                                </View>
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
                                    const isRight = ['total_amount', 'amount_due', 'amount_paid', 'balance', 'outstanding', 'net_salary', 'basic_salary', 'allowances', 'deductions', 'stock_quantity', 'unit_cost', 'min_stock'].includes(col.key);
                                    let val = row[col.key];

                                    // Format cells beautifully based on column key
                                    let displayVal = val;
                                    if (['total_amount', 'amount_due', 'amount_paid', 'balance', 'outstanding', 'net_salary', 'basic_salary', 'allowances', 'deductions', 'unit_cost'].includes(col.key)) {
                                        const amount = parseFloat(val || 0);
                                        displayVal = `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    } else if (col.key === 'is_vat') {
                                        displayVal = val === 1 ? 'VAT' : 'Non VAT';
                                    } else if (col.key === 'code' && !val) {
                                        displayVal = `#${row.id}`;
                                    } else if (['created_at', 'due_date', 'quotation_date', 'delivery_date', 'order_date'].includes(col.key)) {
                                        displayVal = val ? new Date(val).toLocaleDateString('en-GB') : '—';
                                    } else if (val === null || val === undefined || val === '') {
                                        displayVal = '—';
                                    }

                                    // Status and late arrival colors
                                    let cellColor = '#374151';
                                    let isBold = col.key === 'name' || col.key === 'code' || col.key === 'item_code' || col.key === 'employee_code' || col.key === 'employee_name';

                                    if (col.key === 'status') {
                                        const statusStr = String(val).toLowerCase();
                                        if (['paid', 'done', 'converted', 'present', 'active', 'approved'].includes(statusStr)) cellColor = '#15803d';
                                        else if (['pending', 'draft', 'late', 'warning'].includes(statusStr)) cellColor = '#b45309';
                                        else if (['cancelled', 'absent', 'rejected'].includes(statusStr)) cellColor = '#b91c1c';
                                        else if (['leave', 'on leave'].includes(statusStr)) cellColor = '#0284c7';
                                    } else if (['amount_due', 'balance', 'outstanding'].includes(col.key) && parseFloat(val || 0) > 0) {
                                        cellColor = '#b45309';
                                    } else if (col.key === 'check_in' && String(val).includes('(Late)')) {
                                        cellColor = '#dc2626';
                                        isBold = true;
                                    }

                                    return (
                                        <View key={col.key} style={{ width: getColWidth(col.key), paddingHorizontal: 6 }}>
                                            <Text style={[
                                                isBold ? s.tableCellBold : s.tableCell,
                                                {
                                                    textAlign: isRight ? 'right' : 'left',
                                                    color: cellColor,
                                                    width: '100%'
                                                }
                                            ]}>
                                                {String(displayVal)}
                                            </Text>
                                        </View>
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
