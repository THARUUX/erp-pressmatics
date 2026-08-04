import React from 'react';
import {
    Document, Page, View, Text, Svg, Image,
    Rect, Line, Path, G, StyleSheet
} from '@react-pdf/renderer';
import { calculateImpositionLayout, buildImpositionSVGData } from '@/lib/impositionLayout';

// ─── Clean Editorial Design System ─────────────────────────────────────────
const s = StyleSheet.create({
    // Page Shells
    pageLandscape: { backgroundColor: '#ffffff', padding: '20 28', fontFamily: 'Helvetica', fontSize: 8.5, color: '#0f172a' },

    // Header Module
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1.5, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 10 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 150 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, color: '#0f172a' },
    headerCustomer: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginTop: 2 },
    headerSub: { fontSize: 8.5, color: '#64748b', marginTop: 1 },

    headerSOLabel: { fontSize: 6.5, textTransform: 'uppercase', color: '#64748b', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
    headerSOCode: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginVertical: 1 },
    headerDate: { fontSize: 7.5, color: '#334155' },
    headerDelivery: { fontSize: 7.5, color: '#b91c1c', fontFamily: 'Helvetica-Bold', marginTop: 1 },

    // Special Job Notes
    jobNotesRow: { marginVertical: 8, marginBottom: 20 },
    jobNotesTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#b45309', letterSpacing: 0.5, marginBottom: 2, marginTop: 3 },
    jobNotesText: { fontSize: 9.5, color: '#451a03', fontStyle: 'italic' },

    // Production Line Items
    itemBlock: { marginBottom: 12 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#0f172a', paddingBottom: 3, marginBottom: 6 },
    itemHeaderText: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.3 },

    // Detail Specifications Component Row
    detailRow: { paddingVertical: 20, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
    detailHeaderLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    detailTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    detailTypeTag: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#475569', backgroundColor: '#f1f5f9', padding: '1 5', borderRadius: 2 },

    // Spec Meta Rows (No Boxes)
    specGrid: { flexDirection: 'row', gap: 12, marginBottom: 4 },
    specItem: { flex: 1 },
    specLabel: { fontSize: 6.5, textTransform: 'uppercase', color: '#64748b', fontFamily: 'Helvetica-Bold' },
    specValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 1 },

    // Paper & Cut Sheets Line (Clean Text Divider)
    paperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, marginTop: 2 },
    paperText: { fontSize: 8, color: '#334155' },
    paperHighlight: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    sheetHighlight: { fontFamily: 'Helvetica-Bold', color: '#047857' },

    // Modular Tables (No Heavy Boxes)
    sectionTitle: { fontSize: 7.5, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', color: '#1e293b', letterSpacing: 0.5, marginTop: 6, marginBottom: 3 },
    tableHeader: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderTopColor: '#0f172a', borderBottomColor: '#0f172a', paddingVertical: 3, marginBottom: 2 },
    tableHeaderText: { fontSize: 6.5, textTransform: 'uppercase', color: '#0f172a', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', paddingVertical: 3.5, alignItems: 'center' },
    tableCell: { fontSize: 8, color: '#334155' },
    tableCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    tableCol1: { flex: 2.5 },
    tableCol2: { flex: 2 },
    tableCol3: { flex: 1.2, textAlign: 'right' },
    tableCol4: { flex: 1, textAlign: 'right' },

    // Global Finishings Section
    globalSection: { marginTop: 8, paddingTop: 4 },
    globalTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#4338ca', letterSpacing: 0.5, marginBottom: 3 },
    globalBox: { width: 9, height: 9, borderWidth: 0.75, borderColor: '#6366f1', borderRadius: 1.5, backgroundColor: '#ffffff' },

    // Production Floor Sign-off
    signoffRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
    signoffBox: { width: 140, borderTopWidth: 1, borderTopColor: '#64748b', paddingTop: 3, alignItems: 'center' },
    signoffText: { fontSize: 6.5, color: '#64748b', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Multi-Column Layout Grid
    layoutGrid: { flexDirection: 'column', gap: 12 },
    layoutRow: { flexDirection: 'row', gap: 12 },
    layoutCell: { flex: 1, padding: 4, borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' },
    layoutCellTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', marginBottom: 2 },
    layoutDims: { fontSize: 7, color: '#475569', paddingBottom: 2, marginBottom: 4 },
    layoutDimsStrong: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    layoutSvgWrapper: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },

    // QR Panel
    qrPanel: { alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

    // Running Footer
    footer: { position: 'absolute', bottom: 10, left: 28, right: 28, borderTopWidth: 0.5, borderTopColor: '#cbd5e1', paddingTop: 3, textAlign: 'center', fontSize: 6, color: '#94a3b8' },
});

// ─── Formatting Tools ────────────────────────────────────────────────────────
const fmt = v => (v != null ? String(v) : '—');
const fmtTime = t => (parseFloat(t) > 0 ? `${parseFloat(t).toFixed(1)} hr` : '—');

// ─── Precision Imposition Vector Block ───────────────────────────────────────
function ImpositionSVG({ detail, svgW = 340, svgH = 155 }) {
    const rawPaperW = parseFloat(detail.cut_width_cm) || parseFloat(detail.paper_width_cm) || 0;
    const rawPaperH = parseFloat(detail.cut_height_cm) || parseFloat(detail.paper_height_cm) || 0;
    const rawCompW = parseFloat(detail.comp_width_cm) || 0;
    const rawCompH = parseFloat(detail.comp_height_cm) || 0;

    // Swap to rotate 90 degrees if paper is portrait (so it renders landscape in the landscape PDF page)
    const shouldRotate = rawPaperW < rawPaperH;
    const paperWidthCm = shouldRotate ? rawPaperH : rawPaperW;
    const paperHeightCm = shouldRotate ? rawPaperW : rawPaperH;
    const compWidthCm = shouldRotate ? rawCompH : rawCompW;
    const compHeightCm = shouldRotate ? rawCompW : rawCompH;

    const layout = calculateImpositionLayout({
        ups: detail.ups,
        paperWidthCm,
        paperHeightCm,
        compWidthCm,
        compHeightCm,
        bleedMm: detail.bleed_mm ?? 3,
    });

    const { cells, offsetX, offsetY, renderedW, renderedH, fits } = buildImpositionSVGData(layout, svgW, svgH, 20);
    const { W, H, compW, compH } = layout;

    return (
        <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
            <Rect x={offsetX} y={offsetY} width={renderedW} height={renderedH}
                fill="#fafafa" stroke="#94a3b8" strokeWidth={0.75} />

            <Line x1={offsetX} y1={offsetY - 6} x2={offsetX + renderedW} y2={offsetY - 6} stroke="#cbd5e1" strokeWidth={0.5} />
            <Text x={offsetX + renderedW / 2} y={offsetY - 8} fill="#475569"
                style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold' }} textAnchor="middle">{W.toFixed(1)} cm</Text>

            <Line x1={offsetX - 6} y1={offsetY} x2={offsetX - 6} y2={offsetY + renderedH} stroke="#cbd5e1" strokeWidth={0.5} />
            <Text x={offsetX - 9} y={offsetY + renderedH / 2 + 2} fill="#475569"
                style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold' }} textAnchor="middle"
                transform={`rotate(-90 ${offsetX - 9} ${offsetY + renderedH / 2 + 2})`}>{H.toFixed(1)} cm</Text>

            {cells.map(({ i, cellX, cellY, cellW, cellH, overflow, finX, finY, finW, finH }) => (
                <G key={i}>
                    <Rect x={cellX} y={cellY} width={cellW} height={cellH}
                        fill="none" stroke={overflow ? '#ef4444' : '#d97706'}
                        strokeWidth={0.5} strokeDasharray="2,2" />

                    <Rect x={finX} y={finY} width={finW} height={finH}
                        fill={overflow ? '#fee2e2' : '#f0f9ff'}
                        stroke={overflow ? '#dc2626' : '#0284c7'}
                        strokeWidth={0.5} />

                    {i === 0 && (
                        <G>
                            <Text x={finX + finW / 2} y={finY + 6} fill="#64748b" style={{ fontSize: 5 }} textAnchor="middle">
                                {compW.toFixed(1)} cm
                            </Text>
                            <Text x={finX + 2} y={finY + finH / 2 + 1.5} fill="#64748b" style={{ fontSize: 5 }} textAnchor="start">
                                {compH.toFixed(1)} cm
                            </Text>
                        </G>
                    )}

                    <Path d={`M ${finX} ${finY - 2} L ${finX} ${finY - 4} M ${finX - 2} ${finY} L ${finX - 4} ${finY}`} stroke="#94a3b8" strokeWidth={0.5} />
                    <Path d={`M ${finX + finW} ${finY - 2} L ${finX + finW} ${finY - 4} M ${finX + finW + 2} ${finY} L ${finX + finW + 4} ${finY}`} stroke="#94a3b8" strokeWidth={0.5} />
                </G>
            ))}

            {!fits && (
                <Rect x={offsetX} y={offsetY} width={renderedW} height={renderedH}
                    fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4,2" />
            )}
        </Svg>
    );
}

// ─── Modular UI Components ───────────────────────────────────────────────────
const fmtFinishTime = (f, tasks) => {
    const matchedTask = tasks?.find(t =>
        t.machine_id === f.machine_id &&
        t.name.toLowerCase().includes(f.name.toLowerCase())
    );
    const mins = matchedTask ? matchedTask.estimated_minutes : null;
    if (mins != null) {
        return mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} hr`;
    }

    if (f.total_time && parseFloat(f.total_time) > 0) {
        return fmtTime(f.total_time);
    }

    const qty = parseFloat(f.quantity) || 0;
    const speed = parseFloat(f.speed) || 0;
    if (!qty || !speed) return '—';
    if (f.cost_unit === 'Unit') {
        const minsCalc = Math.ceil((qty / speed) * 60);
        return minsCalc < 60 ? `~${minsCalc} min` : `~${(minsCalc / 60).toFixed(1)} hr`;
    }
    return '—';
};

function formatFinishingVolume(f, matchingDetail, itemQuantity) {
    const speedUnit = f.speed_unit || f.machine_speed_unit || f.cost_unit || '';
    const su = speedUnit.toLowerCase().trim();
    const qtyVal = parseFloat(itemQuantity || (matchingDetail && matchingDetail.quantity)) || 0;
    let qty = parseFloat(f.quantity) || 0;

    if (su.includes('unit')) {
        qty = qtyVal;
    } else if (matchingDetail) {
        const pagesVal = parseInt(matchingDetail.pages) || 1;
        const upsVal = parseInt(matchingDetail.ups) || 1;
        const sidesVal = parseInt(matchingDetail.sides) || 1;
        const divisor = upsVal * sidesVal;
        let netCutSheets = parseFloat(matchingDetail.printed_sheets) || 0;
        if (divisor > 0 && qtyVal > 0) {
            netCutSheets = Math.ceil((pagesVal * qtyVal) / divisor);
        }
        const totalCutSheets = netCutSheets + (parseFloat(matchingDetail.wastage_sheets) || 0);

        if (su.includes('print')) {
            qty = totalCutSheets * sidesVal;
        } else if (su.includes('sheet')) {
            qty = totalCutSheets;
        }
    }

    const displayUnit = speedUnit.replace(/\/(Hr|Hour|hr|h)$/i, '').trim();
    return `${fmt(qty)} ${fmt(displayUnit)}`;
}

function FinishingsTable({ finishings, tasks, matchingDetail, itemQuantity }) {
    if (!finishings?.length) return null;
    return (
        <View style={{ marginTop: 4 }}>
            <Text style={s.sectionTitle}>Component Finishing Tasks</Text>
            <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, s.tableCol1]}>Operation</Text>
                <Text style={[s.tableHeaderText, s.tableCol2]}>Target Machine</Text>
                <Text style={[s.tableHeaderText, s.tableCol3]}>Target Volume</Text>
                <Text style={[s.tableHeaderText, s.tableCol4]}>Est Run</Text>
            </View>
            {finishings.map((f, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellBold, s.tableCol1]}>{fmt(f.name)}</Text>
                    <Text style={[s.tableCell, s.tableCol2]}>{fmt(f.machine_name)}</Text>
                    <Text style={[s.tableCell, s.tableCol3]}>{formatFinishingVolume(f, matchingDetail, itemQuantity)}</Text>
                    <Text style={[s.tableCell, s.tableCol4]}>{fmtFinishTime(f, tasks)}</Text>
                </View>
            ))}
        </View>
    );
}

function GlobalFinishingsTable({ finishings, tasks, itemQuantity }) {
    if (!finishings?.length) return null;
    return (
        <View style={s.globalSection}>
            <Text style={s.globalTitle}>Final Order Assembly & Post-Press Treatments (Global)</Text>
            <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, s.tableCol1, { color: '#4338ca' }]}>Operation</Text>
                <Text style={[s.tableHeaderText, s.tableCol3, { color: '#4338ca' }]}>Target Volume</Text>
                <Text style={[s.tableHeaderText, s.tableCol4, { color: '#4338ca' }]}>Est Run</Text>
                <Text style={[s.tableHeaderText, { flex: 0.8, textAlign: 'center', color: '#4338ca' }]}>Sign</Text>
            </View>
            {finishings.map((f, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellBold, s.tableCol1]}>{fmt(f.name)}</Text>
                    <Text style={[s.tableCell, s.tableCol3]}>{formatFinishingVolume(f, null, itemQuantity)}</Text>
                    <Text style={[s.tableCell, s.tableCol4]}>{fmtFinishTime(f, tasks)}</Text>
                    <View style={{ flex: 0.8, alignItems: 'center' }}>
                        <View style={s.globalBox} />
                    </View>
                </View>
            ))}
        </View>
    );
}

function BOMTable({ bom }) {
    if (!bom?.length) return null;
    return (
        <View style={s.globalSection}>
            <Text style={[s.globalTitle, { color: '#047857' }]}>Bill of Materials (Raw Materials & Stock Requisitions)</Text>
            <View style={[s.tableHeader, { borderTopColor: '#059669', borderBottomColor: '#059669' }]}>
                <Text style={[s.tableHeaderText, { flex: 2.5, color: '#065f46' }]}>Material / Component</Text>
                <Text style={[s.tableHeaderText, { flex: 1, color: '#065f46' }]}>Type</Text>
                <Text style={[s.tableHeaderText, { flex: 1.2, color: '#065f46' }]}>Item Code</Text>
                <Text style={[s.tableHeaderText, { flex: 1, textAlign: 'right', color: '#065f46' }]}>Req. Qty</Text>
                <Text style={[s.tableHeaderText, { flex: 0.8, textAlign: 'center', color: '#065f46' }]}>UOM</Text>
                <Text style={[s.tableHeaderText, { flex: 0.8, textAlign: 'center', color: '#065f46' }]}>Verified</Text>
            </View>
            {bom.map((b, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellBold, { flex: 2.5 }]}>{fmt(b.component_name)}</Text>
                    <Text style={[s.tableCell, { flex: 1, textTransform: 'uppercase', fontSize: 6.5 }]}>{fmt(b.component_type)}</Text>
                    <Text style={[s.tableCell, { flex: 1.2 }]}>{fmt(b.item_code)}</Text>
                    <Text style={[s.tableCellBold, { flex: 1, textAlign: 'right', color: '#047857' }]}>
                        {fmt(b.required_qty != null ? parseFloat(b.required_qty).toFixed(0) : '—')}
                    </Text>
                    <Text style={[s.tableCell, { flex: 0.8, textAlign: 'center' }]}>{fmt(b.uom || 'Unit')}</Text>
                    <View style={{ flex: 0.8, alignItems: 'center' }}>
                        <View style={[s.globalBox, { borderColor: '#10b981' }]} />
                    </View>
                </View>
            ))}
        </View>
    );
}

function SFGLinesTable({ sfgLines }) {
    if (!sfgLines?.length) return null;
    return (
        <View style={{ marginTop: 4 }}>
            <Text style={s.sectionTitle}>Required SFG & Stock Assets</Text>
            <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 3 }]}>Item Name / Description</Text>
                <Text style={[s.tableHeaderText, { flex: 1.5 }]}>Item Code</Text>
                <Text style={[s.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Qty Required</Text>
                <Text style={[s.tableHeaderText, { flex: 0.8, textAlign: 'center' }]}>UOM</Text>
                <Text style={[s.tableHeaderText, { flex: 0.8, textAlign: 'center' }]}>Verified</Text>
            </View>
            {sfgLines.map((sfg, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellBold, { flex: 3 }]}>{fmt(sfg.name || sfg.item_name)}</Text>
                    <Text style={[s.tableCell, { flex: 1.5 }]}>{fmt(sfg.item_code)}</Text>
                    <Text style={[s.tableCellBold, { flex: 1, textAlign: 'right' }]}>{fmt(sfg.quantity)}</Text>
                    <Text style={[s.tableCell, { flex: 0.8, textAlign: 'center' }]}>{fmt(sfg.uom || 'Unit')}</Text>
                    <View style={{ flex: 0.8, alignItems: 'center' }}>
                        <View style={s.globalBox} />
                    </View>
                </View>
            ))}
        </View>
    );
}

function ServicesTable({ services }) {
    if (!services?.length) return null;
    return (
        <View style={{ marginTop: 4 }}>
            <Text style={s.sectionTitle}>Production Services & Assignments</Text>
            <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 2 }]}>Service / Task Name</Text>
                <Text style={[s.tableHeaderText, { flex: 1.5 }]}>Assigned Operator</Text>
                <Text style={[s.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Multiplier / Volume</Text>
                <Text style={[s.tableHeaderText, { flex: 2.5 }]}>Operational Notes</Text>
            </View>
            {services.map((svc, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellBold, { flex: 2 }]}>{fmt(svc.service_name)}</Text>
                    <Text style={[s.tableCell, { flex: 1.5 }]}>{fmt(svc.employee_name)}</Text>
                    <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>
                        {fmt(svc.multiply_by)} {svc.rate_unit ? `(${svc.rate_unit})` : ''}
                    </Text>
                    <Text style={[s.tableCell, { flex: 2.5, fontStyle: 'italic', color: '#64748b' }]}>{fmt(svc.note)}</Text>
                </View>
            ))}
        </View>
    );
}

function CleanDetailRow({ detail, tasks, itemQuantity }) {
    const nameLower = (detail.component_name || '').toLowerCase();
    const isFinishing = nameLower.includes('finish');
    const isDigital = detail.type === 'digital';
    const isSFGComp = detail.type === 'sfg' || nameLower.includes('assets') || nameLower.includes('sfg');
    const isServicesComp = detail.type === 'services' || nameLower.includes('service');
    const isPrinting = !isFinishing && !isSFGComp && !isServicesComp;

    const pagesVal = parseInt(detail.pages) || 1;
    const upsVal = parseInt(detail.ups) || 1;
    const sidesVal = parseInt(detail.sides) || 1;
    const qtyVal = parseFloat(itemQuantity || detail.quantity) || 0;
    const divisor = upsVal * sidesVal;

    let netCutSheets = parseFloat(detail.printed_sheets) || 0;
    if (divisor > 0 && qtyVal > 0) {
        netCutSheets = Math.ceil((pagesVal * qtyVal) / divisor);
    }
    const wastageSheets = parseFloat(detail.wastage_sheets) || 0;
    const totalCutSheets = netCutSheets + wastageSheets;

    let estTimeLabel = null;
    if (isPrinting) {
        const matchedTask = tasks?.find(t =>
            t.machine_id === detail.machine_id &&
            t.name.toLowerCase().includes((detail.component_name || '').toLowerCase())
        );
        const mins = matchedTask ? matchedTask.estimated_minutes : null;
        if (mins != null) {
            estTimeLabel = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} hr`;
        } else {
            const pressPasses = totalCutSheets * sidesVal;
            const estMins = detail.machine_speed > 0
                ? Math.ceil((pressPasses / detail.machine_speed) * 60)
                : null;
            estTimeLabel = estMins != null
                ? estMins < 60
                    ? `~${estMins} min`
                    : `~${(estMins / 60).toFixed(1)} hr`
                : null;
        }
    }

    const sfgCount = detail.sfgLines?.length || 0;
    const svcCount = detail.services?.length || 0;
    const finCount = detail.finishings?.length || 0;
    const baseEstHeight = isPrinting ? 130 : 30;
    const estHeight = baseEstHeight + (sfgCount + svcCount + finCount) * 16;
    const shouldWrap = estHeight > 420;

    return (
        <View style={s.detailRow} wrap={!shouldWrap ? false : true}>
            <View style={s.detailHeaderLine}>
                <Text style={s.detailTitle}>{detail.component_name}</Text>
                <Text style={s.detailTypeTag}>{detail.type}</Text>
            </View>

            {isPrinting && (
                <>
                    <View style={s.specGrid}>
                        {detail.machine_name && (
                            <View style={s.specItem}>
                                <Text style={s.specLabel}>Press Machine</Text>
                                <Text style={s.specValue}>{fmt(detail.machine_name)}</Text>
                            </View>
                        )}
                        {!isDigital && (
                            <>
                                <View style={[s.specItem, { flex: 0.6 }]}>
                                    <Text style={s.specLabel}>Front / Back Colours</Text>
                                    <Text style={s.specValue}>{fmt(detail.colors_front ?? detail.colors)} / {detail.colors_back != null ? fmt(detail.colors_back) : (detail.sides === 2 ? '—' : '0')}</Text>
                                </View>
                                <View style={[s.specItem, { flex: 0.6 }]}>
                                    <Text style={s.specLabel}>Sides &amp; Pages</Text>
                                    <Text style={s.specValue}>{detail.sides === 2 ? 'Double' : 'Single'} ({fmt(detail.pages)} pgs)</Text>
                                </View>
                            </>
                        )}
                        {estTimeLabel && (
                            <View style={[s.specItem, { flex: 0.7 }]}>
                                <Text style={s.specLabel}>Est. Press Time</Text>
                                <Text style={[s.specValue, { color: '#1d4ed8' }]}>{estTimeLabel}</Text>
                            </View>
                        )}
                    </View>

                    <View style={s.paperRow}>
                        <Text style={s.paperText}>
                            Stock: <Text style={s.paperHighlight}>{fmt(detail.paper_name)}</Text>
                            {detail.paper_width_cm ? ` (${detail.paper_width_cm}×${detail.paper_height_cm} cm)` : ''}
                        </Text>
                        <Text style={s.paperText}>
                            Cut Sheets: <Text style={s.sheetHighlight}>{fmt(totalCutSheets)}</Text> ({fmt(netCutSheets)} net + {fmt(wastageSheets)} wst)
                            {!isDigital ? `  •  Imposition: ${fmt(detail.ups)} Ups (${fmt(detail.printed_sheets)} imp)` : ''}
                        </Text>
                    </View>
                </>
            )}

            <SFGLinesTable sfgLines={detail.sfgLines} />
            <ServicesTable services={detail.services} />
            <FinishingsTable finishings={detail.finishings} tasks={tasks} matchingDetail={detail} itemQuantity={itemQuantity} />
        </View>
    );
}

// ─── Document Root Components ────────────────────────────────────────────────
function JobTicketPage({ order, qrDataUrl, jobUrl }) {
    const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString() : '—';
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'TBD';

    return (
        <View style={{ paddingBottom: 16 }}>
            <View style={s.headerRow}>
                <View style={s.headerLeft}>
                    <Text style={s.headerTitle}>Production Job Ticket</Text>
                    <Text style={s.headerCustomer}>{order.customer_name}</Text>
                    <Text style={s.headerSub}>Job Description: {order.quotation?.job_description || 'N/A'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={s.headerRight}>
                        <Text style={s.headerSOLabel}>Reference Code</Text>
                        <Text style={s.headerSOCode}>{order.code}</Text>
                        <Text style={s.headerDate}>Issued: {orderDate}</Text>
                        <Text style={s.headerDelivery}>Due Date: {deliveryDate}</Text>
                    </View>
                    {qrDataUrl && (
                        <View style={s.qrPanel}>
                            <Image src={qrDataUrl} style={{ width: 56, height: 56 }} />
                        </View>
                    )}
                </View>
            </View>

            {order.job_notes ? (
                <View style={s.jobNotesRow}>
                    <Text style={s.jobNotesTitle}>SPECIAL JOB NOTES / FLOOR INSTRUCTIONS:</Text>
                    <Text style={s.jobNotesText}>{order.job_notes}</Text>
                </View>
            ) : null}

            {order.items?.map((item, idx) => (
                <View key={item.id || idx} style={s.itemBlock}>
                    <View style={s.itemHeader}>
                        <Text style={s.itemHeaderText}>{idx + 1}. {item.estimation_name || item.job_description}</Text>
                        <Text style={s.itemHeaderText}>Target Yield: {item.quantity} Units</Text>
                    </View>

                    {item.details?.filter(d => {
                        const nameLower = (d.component_name || '').toLowerCase();
                        const isFinishing = nameLower.includes('finish');
                        const isSFGComp = d.type === 'sfg' || nameLower.includes('assets') || nameLower.includes('sfg');
                        const isServicesComp = d.type === 'services' || nameLower.includes('service');
                        const isPrinting = !isFinishing && !isSFGComp && !isServicesComp;

                        if (isPrinting) return true;
                        return (d.finishings?.length > 0 || d.services?.length > 0 || d.sfgLines?.length > 0);
                    }).map((detail, dIdx) => (
                        <CleanDetailRow key={detail.id || dIdx} detail={detail} tasks={order.tasks} itemQuantity={item.quantity} />
                    ))}

                    <GlobalFinishingsTable finishings={item.globalFinishings} tasks={order.tasks} itemQuantity={item.quantity} />
                </View>
            ))}

            <BOMTable bom={order.bom} />
        </View>
    );
}

function ImpositionLayoutsSection({ order }) {
    const layouts = [];
    order.items?.forEach((item, itemIdx) => {
        item.details
            ?.filter(d => {
                const name = (d.component_name || '').toLowerCase();
                return d.type !== 'digital' && d.type !== 'sfg' && d.type !== 'services' &&
                    !name.includes('services') && !name.includes('sfg') && !name.includes('assets') &&
                    !name.includes('finish') && d.comp_width_cm && d.comp_height_cm;
            })
            .forEach((detail, dIdx) => {
                layouts.push({ item, itemIdx, detail, dIdx });
            });
    });

    if (!layouts.length) return null;

    return (
        <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#0f172a' }}>
            <View style={[s.headerRow, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 6 }]}>
                <View style={s.headerLeft}>
                    <Text style={[s.headerTitle, { fontSize: 11 }]}>Imposition & Layout Allocation Plans</Text>
                    <Text style={s.headerSub}>{order.customer_name} — Layout Specifications</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.headerSOLabel}>Job Reference</Text>
                    <Text style={[s.headerSOCode, { fontSize: 10 }]}>{order.code}</Text>
                </View>
            </View>

            <View style={s.layoutGrid}>
                {Array.from({ length: Math.ceil(layouts.length / 2) }, (_, rowIdx) => {
                    const pair = layouts.slice(rowIdx * 2, rowIdx * 2 + 2);
                    return (
                        <View key={rowIdx} style={s.layoutRow} wrap={false}>
                            {pair.map(({ item, itemIdx, detail, dIdx }) => (
                                <View key={`${item.id || itemIdx}-${detail.id || dIdx}`} style={s.layoutCell}>
                                    <Text style={s.layoutCellTitle}>
                                        {itemIdx + 1}.{dIdx + 1} {detail.component_name} Block
                                    </Text>
                                    <Text style={s.layoutDims}>
                                        Stock: <Text style={s.layoutDimsStrong}>{detail.paper_width_cm}×{detail.paper_height_cm} cm</Text>
                                        {'  '}•{'  '}Cut Size: <Text style={s.layoutDimsStrong}>{detail.cut_width_cm}×{detail.cut_height_cm} cm</Text>
                                        {'  '}•{'  '}Margins: <Text style={s.layoutDimsStrong}>{detail.bleed_mm ?? 3}mm Bleed</Text>
                                    </Text>
                                    <View style={s.layoutSvgWrapper}>
                                        <ImpositionSVG detail={detail} svgW={340} svgH={150} />
                                    </View>
                                </View>
                            ))}
                            {pair.length === 1 && <View style={[s.layoutCell, { borderBottomColor: 'transparent' }]} />}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ─── Orchestration Document Root ─────────────────────────────────────────────
export default function JobTicketCleanDocument({ order, qrDataUrl, jobUrl }) {
    const timestamp = new Date().toLocaleString('en-US', { hour12: false });

    // Determine if we actually have imposition layout plans to print
    const hasImpositions = order.items?.some(item =>
        item.details?.some(d => {
            const name = (d.component_name || '').toLowerCase();
            return d.type !== 'digital' && d.type !== 'sfg' && d.type !== 'services' &&
                !name.includes('services') && !name.includes('sfg') && !name.includes('assets') &&
                !name.includes('finish') && d.comp_width_cm && d.comp_height_cm;
        })
    );

    return (
        <Document title={`JobTicket-${order.code}`} author="Pressmatics ERP Architecture">
            {/* Page 1: Main Job Ticket Specifications and Tables */}
            <Page size="A4" orientation="landscape" style={s.pageLandscape}>
                <JobTicketPage order={order} qrDataUrl={qrDataUrl} jobUrl={jobUrl} />
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>

            {/* Page 2: Imposition Layout allocation diagrams */}
            {hasImpositions && (
                <Page size="A4" orientation="landscape" style={s.pageLandscape}>
                    <ImpositionLayoutsSection order={order} />
                    <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                        `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                    )} />
                </Page>
            )}
        </Document>
    );
}
