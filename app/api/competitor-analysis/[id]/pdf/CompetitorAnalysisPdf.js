import React from 'react';
import {
    Document, Page, Text, View, StyleSheet, Font
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        color: '#1a1a1a',
        fontFamily: 'Helvetica',
        padding: 36,
        fontSize: 9,
    },
    // Header
    header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 14 },
    title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 3 },
    subtitle: { fontSize: 9, color: '#64748b', marginBottom: 2 },
    metaRow: { flexDirection: 'row', gap: 20, marginTop: 8 },
    metaItem: { flexDirection: 'row', gap: 4 },
    metaLabel: { color: '#94a3b8', fontSize: 8 },
    metaValue: { color: '#334155', fontSize: 8, fontFamily: 'Helvetica-Bold' },

    // Section
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    card: { backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', padding: 10, marginBottom: 6 },
    divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 6 },

    // Comparison table
    tableHeader: { flexDirection: 'row', backgroundColor: '#e2e8f0', padding: '5 10', borderRadius: 4, marginBottom: 2 },
    tableRow: { flexDirection: 'row', padding: '7 10', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    col1: { flex: 2 },
    col2: { flex: 1, textAlign: 'right' },
    col3: { flex: 1, textAlign: 'right' },
    colLabel: { fontSize: 7, color: '#64748b', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
    colVal: { fontSize: 9, color: '#0f172a' },
    colSub: { fontSize: 7, color: '#94a3b8', marginTop: 1 },

    // Our price row
    ourRow: { flexDirection: 'row', padding: '8 10', backgroundColor: '#eef2ff', borderRadius: 4, borderWidth: 1, borderColor: '#c7d2fe', marginBottom: 2 },

    // Diff badge
    diffGreen: { color: '#16a34a', fontFamily: 'Helvetica-Bold', fontSize: 8 },
    diffRed: { color: '#dc2626', fontFamily: 'Helvetica-Bold', fontSize: 8 },
    diffNeutral: { color: '#94a3b8', fontSize: 8 },

    // Snapshot
    snapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    snapCard: { backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', padding: 8, width: '47%' },
    snapLabel: { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 },
    snapName: { fontSize: 9, color: '#0f172a', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    snapLine: { fontSize: 8, color: '#475569', marginBottom: 1 },
    snapLineDiff: { fontSize: 7, marginBottom: 1 },

    // Footer
    footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6 },
    footerText: { fontSize: 7, color: '#94a3b8' },
});

function DiffText({ ours, theirs }) {
    if (!ours || !theirs) return <Text style={styles.diffNeutral}>—</Text>;
    const diff = ((theirs - ours) / ours) * 100;
    if (diff > 0) return <Text style={styles.diffGreen}>+{diff.toFixed(1)}% (they charge more)</Text>;
    if (diff < 0) return <Text style={styles.diffRed}>{diff.toFixed(1)}% (they are cheaper)</Text>;
    return <Text style={styles.diffNeutral}>At par</Text>;
}

export default function CompetitorAnalysisPdf({ analysis, currency = '' }) {
    const snap = analysis.estimation_snapshot;
    const ours = parseFloat(analysis.our_total) || null;
    const qty = parseFloat(snap?.quantity) || null;
    const ourUnitPrice = (ours && qty) ? ours / qty : null;
    const competitors = analysis.competitors || [];
    const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{analysis.name}</Text>
                    {analysis.description ? <Text style={styles.subtitle}>{analysis.description}</Text> : null}
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Created:</Text>
                            <Text style={styles.metaValue}>{new Date(analysis.created_at).toLocaleDateString()}</Text>
                        </View>
                        {analysis.usd_rate && (
                            <View style={styles.metaItem}>
                                <Text style={styles.metaLabel}>USD Rate:</Text>
                                <Text style={styles.metaValue}>1 USD = {analysis.usd_rate} local</Text>
                            </View>
                        )}
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Exported:</Text>
                            <Text style={styles.metaValue}>{now}</Text>
                        </View>
                    </View>
                </View>

                {/* Price Comparison */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Price Comparison (per unit)</Text>

                    {/* Table header */}
                    <View style={styles.tableHeader}>
                        <View style={styles.col1}><Text style={styles.colLabel}>Competitor</Text></View>
                        <View style={styles.col2}><Text style={styles.colLabel}>Unit Price</Text></View>
                        <View style={styles.col3}><Text style={styles.colLabel}>vs Our Price</Text></View>
                    </View>

                    {/* Our row */}
                    {ourUnitPrice && (
                        <View style={styles.ourRow}>
                            <View style={styles.col1}>
                                <Text style={[styles.colVal, { fontFamily: 'Helvetica-Bold', color: '#4f46e5' }]}>Our Price</Text>
                                {snap && <Text style={styles.colSub}>{snap.estimation_name}</Text>}
                            </View>
                            <View style={styles.col2}>
                                <Text style={[styles.colVal, { fontFamily: 'Helvetica-Bold' }]}>{currency}{ourUnitPrice.toFixed(2)}/unit</Text>
                                {ours && qty && <Text style={styles.colSub}>{currency}{ours.toFixed(2)} total · {qty} units</Text>}
                            </View>
                            <View style={styles.col3}><Text style={styles.colSub}>—</Text></View>
                        </View>
                    )}

                    {/* Competitor rows */}
                    {competitors.map((c, i) => {
                        const theirUnit = parseFloat(c.quoted_price) || null;
                        return (
                            <View key={i} style={styles.tableRow}>
                                <View style={styles.col1}>
                                    <Text style={styles.colVal}>{c.competitor_name}</Text>
                                    {c.notes ? <Text style={styles.colSub}>{c.notes}</Text> : null}
                                </View>
                                <View style={styles.col2}>
                                    <Text style={styles.colVal}>{theirUnit ? `${currency}${theirUnit.toFixed(2)}/unit` : '—'}</Text>
                                </View>
                                <View style={styles.col3}>
                                    <DiffText ours={ourUnitPrice} theirs={theirUnit} />
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Estimation Snapshot */}
                {snap && snap.components && snap.components.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Estimation Cost Snapshot — {snap.estimation_name}</Text>
                        <View style={styles.snapGrid}>
                            {snap.components.map((comp, i) => {
                                const compTotal = (comp.final_paper_cost || 0) + (comp.final_plate_cost || 0) +
                                    (comp.final_printing_cost || 0) + (comp.final_finishing_cost || 0);
                                const compFinishings = comp.finishings || [];
                                return (
                                    <View key={i} style={styles.snapCard}>
                                        <Text style={styles.snapName}>{comp.name}</Text>
                                        <Text style={styles.colSub}>{comp.type}{comp.machine_name ? ` · ${comp.machine_name}` : ''}</Text>
                                        <View style={styles.divider} />
                                        {comp.paper_name && (
                                            <View>
                                                <Text style={styles.snapLine}>Paper: {comp.paper_name}</Text>
                                                <Text style={styles.snapLine}>Est: {currency}{comp.paper_cost_per_sheet?.toFixed(2)}/sheet</Text>
                                                {comp.current_paper_unit_cost != null && (
                                                    <Text style={[styles.snapLineDiff, { color: comp.current_paper_unit_cost > comp.paper_cost_per_sheet ? '#dc2626' : '#16a34a' }]}>
                                                        Now: {currency}{comp.current_paper_unit_cost?.toFixed(2)}/{comp.current_paper_uom || 'sheet'}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                        {comp.plate_cost_unit > 0 && (
                                            <Text style={styles.snapLine}>Plate: {currency}{comp.plate_cost_unit?.toFixed(2)}/plate · {comp.plate_count} plates</Text>
                                        )}
                                        {comp.impression_cost_unit > 0 && (
                                            <Text style={styles.snapLine}>Impression: {currency}{comp.impression_cost_unit?.toFixed(2)} · {comp.printed_sheets?.toLocaleString()} sheets</Text>
                                        )}
                                        {compFinishings.length > 0 && (
                                            <View style={{ marginTop: 4 }}>
                                                <Text style={[styles.snapLabel, { marginBottom: 2 }]}>Finishings</Text>
                                                {compFinishings.map((f, fi) => (
                                                    <View key={fi} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                                                        <Text style={styles.snapLine}>{f.name}{f.machine_name ? ` (${f.machine_name})` : ''}</Text>
                                                        <Text style={[styles.snapLine, { fontFamily: 'Helvetica-Bold', color: '#334155' }]}>{currency}{parseFloat(f.total_cost).toFixed(2)}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        <View style={styles.divider} />
                                        <Text style={[styles.snapLine, { fontFamily: 'Helvetica-Bold', color: '#0f172a' }]}>
                                            Total: {currency}{compTotal.toFixed(2)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Global Finishings */}
                        {snap.global_finishings && snap.global_finishings.length > 0 && (
                            <View style={{ marginTop: 8 }}>
                                <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>Global Finishings</Text>
                                <View style={styles.tableHeader}>
                                    <View style={{ flex: 2 }}><Text style={styles.colLabel}>Name</Text></View>
                                    <View style={{ flex: 1 }}><Text style={styles.colLabel}>Qty / Unit</Text></View>
                                    <View style={{ flex: 1, textAlign: 'right' }}><Text style={styles.colLabel}>Unit Cost</Text></View>
                                    <View style={{ flex: 1, textAlign: 'right' }}><Text style={styles.colLabel}>Total</Text></View>
                                </View>
                                {snap.global_finishings.map((f, fi) => (
                                    <View key={fi} style={styles.tableRow}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={styles.colVal}>{f.name}</Text>
                                            {f.machine_name && <Text style={styles.colSub}>{f.machine_name}</Text>}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.colVal}>{f.quantity} {f.cost_unit}</Text>
                                        </View>
                                        <View style={{ flex: 1, textAlign: 'right' }}>
                                            <Text style={styles.colVal}>{currency}{parseFloat(f.unit_cost).toFixed(2)}</Text>
                                        </View>
                                        <View style={{ flex: 1, textAlign: 'right' }}>
                                            <Text style={[styles.colVal, { fontFamily: 'Helvetica-Bold' }]}>{currency}{parseFloat(f.total_cost).toFixed(2)}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Pressmatics ERP · Competitor Analysis</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
