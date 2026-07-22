import React from 'react';
import {
    Document, Page, View, Text, Svg, Image,
    Rect, Line, Path, G, StyleSheet
} from '@react-pdf/renderer';
import { calculateImpositionLayout, buildImpositionSVGData } from '@/lib/impositionLayout';

// ─── Design System Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
    // Page Shells
    pagePortrait: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a' },
    pageLandscape: { backgroundColor: '#ffffff', padding: 24, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a' },

    // Header Module
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#1e293b', paddingBottom: 6, marginBottom: 12 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', width: 140 },
    headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, color: '#0f172a' },
    headerCustomer: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginTop: 2 },
    headerSub: { fontSize: 8.5, color: '#64748b', marginTop: 1 },

    headerSOLabel: { fontSize: 7, textTransform: 'uppercase', color: '#64748b', fontFamily: 'Helvetica-Bold' },
    headerSOCode: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginVertical: 1 },
    headerDate: { fontSize: 8, color: '#334155' },
    headerDelivery: { fontSize: 8, color: '#b91c1c', fontFamily: 'Helvetica-Bold', marginTop: 1 },

    // Production Item Wrapper
    itemBlock: { marginBottom: 16 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e293b', padding: '6 10', borderRadius: 4, marginBottom: 6 },
    itemHeaderText: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase' },

    // Technical Specifications Component Card
    detailCard: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 8, marginBottom: 6, backgroundColor: '#f8fafc' },
    detailBadge: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#475569', backgroundColor: '#e2e8f0', padding: '2 6', borderRadius: 2, alignSelf: 'flex-start', marginBottom: 6 },

    // Meta Specifications Grid
    infoGrid: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    infoCell: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', padding: '4 6', borderRadius: 3 },
    infoLabel: { fontSize: 6.5, textTransform: 'uppercase', color: '#64748b', fontFamily: 'Helvetica-Bold', marginBottom: 1 },
    infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },

    // Primary Production Stock Box
    paperBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 4, padding: '6 8', flexDirection: 'row', gap: 6, marginBottom: 6 },
    paperBoxLeft: { flex: 2.5 },
    paperBoxCell: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dcfce7', padding: '4 6', borderRadius: 3, alignItems: 'center' },
    paperBoxLabel: { fontSize: 6.5, textTransform: 'uppercase', color: '#166534', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    paperBoxValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#14532d' },
    paperBoxSub: { fontSize: 7, color: '#475569', marginTop: 1 },

    // Component Operations Table
    sectionTitle: { fontSize: 7.5, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', color: '#334155', borderLeftWidth: 2, borderLeftColor: '#0f172a', paddingLeft: 4, marginBottom: 4, marginTop: 4 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#e2e8f0', padding: '3 6', borderRadius: 2, marginBottom: 2 },
    tableHeaderText: { fontSize: 6.5, textTransform: 'uppercase', color: '#475569', fontFamily: 'Helvetica-Bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 3, paddingHorizontal: 6, alignItems: 'center' },
    tableCell: { fontSize: 8, color: '#334155' },
    tableCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    tableCol1: { flex: 2.5 },
    tableCol2: { flex: 2 },
    tableCol3: { flex: 1.2, textAlign: 'right' },
    tableCol4: { flex: 1, textAlign: 'right' },

    // Post-Press Global Finishings Block
    globalSection: { borderLeftWidth: 3, borderLeftColor: '#4f46e5', paddingLeft: 8, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 4, padding: 6, marginTop: 4 },
    globalTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#4338ca', marginBottom: 4 },
    globalBox: { width: 10, height: 10, borderWidth: 1, borderColor: '#a78bfa', borderRadius: 2, backgroundColor: '#ffffff' },

    // Production Floor Sign-off
    signoffRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
    signoffBox: { width: 130, borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 3, alignItems: 'center' },
    signoffText: { fontSize: 7, color: '#64748b', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },

    // Multi-Column Layout Grid (Landscape Page)
    layoutGrid: { flexDirection: 'column', gap: 10 },
    layoutRow: { flexDirection: 'row', gap: 10 },
    layoutCell: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 6, backgroundColor: '#f8fafc' },
    layoutCellTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', marginBottom: 2 },
    layoutDims: { fontSize: 7.2, color: '#475569', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingBottom: 3, marginBottom: 6 },
    layoutDimsStrong: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    layoutSvgWrapper: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: 3, paddingVertical: 4 },

    // QR Panel
    qrPanel: { alignItems: 'center', justifyContent: 'center', marginLeft: 8, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 4, backgroundColor: '#f8fafc' },
    qrLabel: { fontSize: 5.5, color: '#64748b', textAlign: 'center', marginTop: 2, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },

    // Sticky Global Running Footer
    footer: { position: 'absolute', bottom: 14, left: 24, right: 24, borderTopWidth: 0.5, borderTopColor: '#cbd5e1', paddingTop: 4, textAlign: 'center', fontSize: 6.5, color: '#94a3b8' },
});

// ─── Formatting Tools ────────────────────────────────────────────────────────
const fmt = v => (v != null ? String(v) : '—');
const fmtTime = t => (parseFloat(t) > 0 ? `${parseFloat(t).toFixed(1)} hr` : '—');

// ─── Precision Imposition Vector Block ───────────────────────────────────────
function ImpositionSVG({ detail, svgW = 340, svgH = 160 }) {
    const layout = calculateImpositionLayout({
        ups: detail.ups,
        paperWidthCm: detail.paper_width_cm,
        paperHeightCm: detail.paper_height_cm,
        compWidthCm: detail.comp_width_cm,
        compHeightCm: detail.comp_height_cm,
        bleedMm: detail.bleed_mm ?? 3,
    });

    const { cells, offsetX, offsetY, renderedW, renderedH, fits } = buildImpositionSVGData(layout, svgW, svgH, 24);
    const { W, H, compW, compH } = layout;

    return (
        <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
            {/* Main Sheet Boundary */}
            <Rect x={offsetX} y={offsetY} width={renderedW} height={renderedH}
                fill="#f1f5f9" stroke="#64748b" strokeWidth={1} />

            {/* Horizontal Dimensional Callout Rule */}
            <Line x1={offsetX} y1={offsetY - 8} x2={offsetX + renderedW} y2={offsetY - 8} stroke="#94a3b8" strokeWidth={0.5} />
            <Line x1={offsetX} y1={offsetY - 11} x2={offsetX} y2={offsetY - 5} stroke="#94a3b8" strokeWidth={0.5} />
            <Line x1={offsetX + renderedW} y1={offsetY - 11} x2={offsetX + renderedW} y2={offsetY - 5} stroke="#94a3b8" strokeWidth={0.5} />
            <Text x={offsetX + renderedW / 2} y={offsetY - 11} fill="#334155"
                style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} textAnchor="middle">{W.toFixed(1)} cm</Text>

            {/* Vertical Dimensional Callout Rule */}
            <Line x1={offsetX - 8} y1={offsetY} x2={offsetX - 8} y2={offsetY + renderedH} stroke="#94a3b8" strokeWidth={0.5} />
            <Line x1={offsetX - 11} y1={offsetY} x2={offsetX - 5} y2={offsetY} stroke="#94a3b8" strokeWidth={0.5} />
            <Line x1={offsetX - 11} y1={offsetY + renderedH} x2={offsetX - 5} y2={offsetY + renderedH} stroke="#94a3b8" strokeWidth={0.5} />
            <Text x={offsetX - 12} y={offsetY + renderedH / 2 + 2} fill="#334155"
                style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} textAnchor="middle"
                transform={`rotate(-90 ${offsetX - 12} ${offsetY + renderedH / 2 + 2})`}>{H.toFixed(1)} cm</Text>

            {/* Step & Repeat Press Ups */}
            {cells.map(({ i, cellX, cellY, cellW, cellH, overflow, finX, finY, finW, finH }) => (
                <G key={i}>
                    {/* Outer Trim/Bleed Guide */}
                    <Rect x={cellX} y={cellY} width={cellW} height={cellH}
                        fill="none" stroke={overflow ? '#ef4444' : '#f59e0b'}
                        strokeWidth={0.5} strokeDasharray="2,2" />

                    {/* Finished Cut Area */}
                    <Rect x={finX} y={finY} width={finW} height={finH}
                        fill={overflow ? '#fee2e2' : '#eff6ff'}
                        stroke={overflow ? '#dc2626' : '#2563eb'}
                        strokeWidth={0.75} />

                    {/* Ident Label inside Imposition Cut */}
                    {/* <Text x={finX + finW / 2} y={finY + finH / 2 + 2.5}
                        fill={overflow ? '#b91c1c' : '#1e40af'}
                        style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} textAnchor="middle">Up {i + 1}</Text> */}

                    {/* Primary Component Proportional Reference Scale */}
                    {i === 0 && (
                        <G>
                            <Text x={finX + finW / 2} y={finY + 7} fill="#475569" style={{ fontSize: 5 }} textAnchor="middle">
                                {compW.toFixed(1)} cm
                            </Text>
                            <Text x={finX + 2} y={finY + finH / 2 + 1.5} fill="#475569" style={{ fontSize: 5 }} textAnchor="start">
                                {compH.toFixed(1)} cm
                            </Text>
                        </G>
                    )}

                    {/* Registration Crop Marks */}
                    <Path d={`M ${finX} ${finY - 2} L ${finX} ${finY - 5} M ${finX - 2} ${finY} L ${finX - 5} ${finY}`} stroke="#64748b" strokeWidth={0.5} />
                    <Path d={`M ${finX + finW} ${finY - 2} L ${finX + finW} ${finY - 5} M ${finX + finW + 2} ${finY} L ${finX + finW + 5} ${finY}`} stroke="#64748b" strokeWidth={0.5} />
                    <Path d={`M ${finX} ${finY + finH + 2} L ${finX} ${finY + finH + 5} M ${finX - 2} ${finY + finH} L ${finX - 5} ${finY + finH}`} stroke="#64748b" strokeWidth={0.5} />
                    <Path d={`M ${finX + finW} ${finY + finH + 2} L ${finX + finW} ${finY + finH + 5} M ${finX + finW + 2} ${finY + finH} L ${finX + finW + 5} ${finY + finH}`} stroke="#64748b" strokeWidth={0.5} />
                </G>
            ))}

            {/* Enclosing Warning Border for Layout Violations */}
            {!fits && (
                <Rect x={offsetX} y={offsetY} width={renderedW} height={renderedH}
                    fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4,2" />
            )}
        </Svg>
    );
}

// ─── Modular UI Blocks ───────────────────────────────────────────────────────
// Finishing est time: quantity / machine.speed → minutes
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
    let qty = parseFloat(f.quantity) || 0;

    if (matchingDetail) {
        const pagesVal = parseInt(matchingDetail.pages) || 1;
        const upsVal = parseInt(matchingDetail.ups) || 1;
        const sidesVal = parseInt(matchingDetail.sides) || 1;
        const qtyVal = parseFloat(itemQuantity || matchingDetail.quantity) || 0;
        const divisor = upsVal * sidesVal;
        let netCutSheets = parseFloat(matchingDetail.printed_sheets) || 0;
        if (divisor > 0 && qtyVal > 0) {
            netCutSheets = Math.ceil((pagesVal * qtyVal) / divisor);
        }
        const totalCutSheets = netCutSheets + (parseFloat(matchingDetail.wastage_sheets) || 0);

        const su = speedUnit.toLowerCase().trim();
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
                <Text style={[s.tableHeaderText, { flex: 1, textAlign: 'center', color: '#4338ca' }]}>Sign</Text>
            </View>
            {finishings.map((f, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellBold, s.tableCol1]}>{fmt(f.name)}</Text>
                    <Text style={[s.tableCell, s.tableCol3]}>{formatFinishingVolume(f, null, itemQuantity)}</Text>
                    <Text style={[s.tableCell, s.tableCol4]}>{fmtFinishTime(f, tasks)}</Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
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
            <View style={[s.tableHeader, { backgroundColor: '#ecfdf5' }]}>
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
                    <Text style={[s.tableCell, { flex: 1, textTransform: 'uppercase', fontSize: 7 }]}>{fmt(b.component_type)}</Text>
                    <Text style={[s.tableCell, { flex: 1.2 }]}>{fmt(b.item_code)}</Text>
                    <Text style={[s.tableCellBold, { flex: 1, textAlign: 'right', color: '#047857' }]}>
                        {fmt(b.required_qty != null ? parseFloat(b.required_qty).toFixed(0) : '—')}
                    </Text>
                    <Text style={[s.tableCell, { flex: 0.8, textAlign: 'center' }]}>{fmt(b.uom || 'Unit')}</Text>
                    <View style={{ flex: 0.8, alignItems: 'center' }}>
                        <View style={[s.globalBox, { borderColor: '#a7f3d0', width: 9, height: 9 }]} />
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
                <Text style={[s.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Verified</Text>
            </View>
            {sfgLines.map((line, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellBold, { flex: 3 }]}>{fmt(line.item_name)}</Text>
                    <Text style={[s.tableCell, { flex: 1.5 }]}>{fmt(line.item_code)}</Text>
                    <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{fmt(line.quantity)}</Text>
                    <Text style={[s.tableCell, { flex: 0.8, textAlign: 'center' }]}>{fmt(line.uom || 'Unit')}</Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <View style={[s.globalBox, { borderColor: '#cbd5e1', width: 9, height: 9 }]} />
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

function DetailCard({ detail, tasks, itemQuantity }) {
    const nameLower = (detail.component_name || '').toLowerCase();
    const isFinishing = nameLower.includes('finish');
    const isDigital = detail.type === 'digital';
    const isSFGComp = detail.type === 'sfg' || nameLower.includes('assets') || nameLower.includes('sfg');
    const isServicesComp = detail.type === 'services' || nameLower.includes('service');
    const isPrinting = !isFinishing && !isSFGComp && !isServicesComp;

    // Calculate actual Cut Sheets (net cut sheets + wastage)
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

    // Est. press time: check tasks list first, then fallback to speed formula
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
        <View style={s.detailCard} wrap={!shouldWrap ? false : true}>
            <Text style={s.detailBadge}>{detail.component_name} / {detail.type}</Text>

            {isPrinting && (
                <>
                    {detail.machine_name && (
                        <View style={s.infoGrid}>
                            <View style={s.infoCell}>
                                <Text style={s.infoLabel}>Assigned Press Machine</Text>
                                <Text style={s.infoValue}>{fmt(detail.machine_name)}</Text>
                            </View>
                            {!isDigital && (
                                <>
                                    <View style={[s.infoCell, { flex: 0.6 }]}>
                                        <Text style={s.infoLabel}>Front Colours</Text>
                                        <Text style={s.infoValue}>{fmt(detail.colors_front ?? detail.colors)}</Text>
                                    </View>
                                    <View style={[s.infoCell, { flex: 0.6 }]}>
                                        <Text style={s.infoLabel}>Back Colours</Text>
                                        <Text style={s.infoValue}>{detail.colors_back != null ? fmt(detail.colors_back) : (detail.sides === 2 ? '—' : '0')}</Text>
                                    </View>
                                    <View style={[s.infoCell, { flex: 0.6 }]}>
                                        <Text style={s.infoLabel}>Sides</Text>
                                        <Text style={s.infoValue}>{detail.sides === 2 ? 'Double' : 'Single'}</Text>
                                    </View>
                                    <View style={[s.infoCell, { flex: 0.5 }]}>
                                        <Text style={s.infoLabel}>Pages</Text>
                                        <Text style={s.infoValue}>{fmt(detail.pages)}</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    )}

                    <View style={s.paperBox}>
                        <View style={s.paperBoxLeft}>
                            <Text style={s.paperBoxLabel}>Raw Paper stock Description</Text>
                            <Text style={[s.paperBoxValue, { fontSize: 9.5 }]}>{fmt(detail.paper_name)}</Text>
                            {detail.paper_width_cm && (
                                <Text style={s.paperBoxSub}>
                                    Parent Dimensions: {detail.paper_width_cm} × {detail.paper_height_cm} cm
                                </Text>
                            )}
                        </View>
                        <View style={s.paperBoxCell}>
                            <Text style={s.paperBoxLabel}>Cut Sheets</Text>
                            <Text style={s.paperBoxValue}>{fmt(totalCutSheets)}</Text>
                            <Text style={[s.paperBoxSub, { fontSize: 6.5, color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>
                                ({fmt(netCutSheets)} + {fmt(wastageSheets)} wst)
                            </Text>
                        </View>
                        {!isDigital && (
                            <View style={s.paperBoxCell}>
                                <Text style={s.paperBoxLabel}>Imposition</Text>
                                <Text style={s.paperBoxValue}>{fmt(detail.ups)} Ups</Text>
                                <Text style={s.paperBoxSub}>Impressions: {fmt(detail.printed_sheets)}</Text>
                            </View>
                        )}
                        {estTimeLabel && (
                            <View style={[s.paperBoxCell, { borderColor: '#bfdbfe' }]}>
                                <Text style={[s.paperBoxLabel, { color: '#1d4ed8' }]}>Est. Press Time</Text>
                                <Text style={[s.paperBoxValue, { color: '#1e40af' }]}>{estTimeLabel}</Text>
                                <Text style={s.paperBoxSub}>{detail.sides === 2 ? '2-sided' : '1-sided'}</Text>
                            </View>
                        )}
                    </View>
                </>
            )}

            <SFGLinesTable sfgLines={detail.sfgLines} />
            <ServicesTable services={detail.services} />
            <FinishingsTable finishings={detail.finishings} tasks={tasks} matchingDetail={detail} itemQuantity={itemQuantity} />
        </View>
    );
}


// ─── Form Page 1 Components (Portrait) ───────────────────────────────────────
function JobTicketPage({ order, qrDataUrl, jobUrl }) {
    const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString() : '—';
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'TBD';

    return (
        <View style={{ paddingBottom: 20 }}>
            <View style={s.headerRow}>
                <View style={s.headerLeft}>
                    <Text style={s.headerTitle}>Production Job Ticket</Text>
                    <Text style={s.headerCustomer}>{order.customer_name}</Text>
                    <Text style={s.headerSub}>Job Context: {order.quotation?.job_description || 'N/A'}</Text>
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
                            <Image src={qrDataUrl} style={{ width: 64, height: 64 }} />
                        </View>
                    )}
                </View>
            </View>

            {order.job_notes ? (
                <View style={{ backgroundColor: '#fffbe8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 4, padding: 6, marginBottom: 10 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#854d0e', marginBottom: 2 }}>
                        SPECIAL JOB NOTES / FLOOR INSTRUCTIONS:
                    </Text>
                    <Text style={{ fontSize: 8.5, color: '#713f12' }}>{order.job_notes}</Text>
                </View>
            ) : null}

            {order.items?.map((item, idx) => (
                <View key={item.id || idx} style={s.itemBlock}>
                    <View style={s.itemHeader}>
                        <Text style={s.itemHeaderText}>{idx + 1}. {item.estimation_name || item.job_description}</Text>
                        <Text style={s.itemHeaderText}>Target Yield: {item.quantity} Units</Text>
                    </View>

                    {item.details?.filter(d => {
                        const name = (d.component_name || '').toLowerCase();
                        return !name.includes('finish') && !['services', 'sfg', 'assets'].includes(name);
                    }).map((detail, dIdx) => (
                        <DetailCard key={detail.id || dIdx} detail={detail} tasks={order.tasks} itemQuantity={item.quantity} />
                    ))}

                    <GlobalFinishingsTable finishings={item.globalFinishings} tasks={order.tasks} itemQuantity={item.quantity} />
                </View>
            ))}

            <BOMTable bom={order.bom} />

            <View style={s.signoffRow} wrap={false}>
                <View style={s.signoffBox}>
                    <Text style={s.signoffText}>Floor Controller Sign-Off</Text>
                </View>
            </View>
        </View>
    );
}

// ─── Form Page 2 Components (Landscape) ──────────────────────────────────────
function ImpositionLayoutsPage({ order }) {
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
        <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
            <View style={[s.headerRow, { marginBottom: 8 }]}>
                <View style={s.headerLeft}>
                    <Text style={[s.headerTitle, { fontSize: 11 }]}>Imposition & Layout Allocation Plans</Text>
                    <Text style={s.headerSub}>{order.customer_name} — Layout Master Specifications</Text>
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
                                        <ImpositionSVG detail={detail} svgW={340} svgH={155} />
                                    </View>
                                </View>
                            ))}
                            {pair.length === 1 && <View style={[s.layoutCell, { borderColor: 'transparent', backgroundColor: 'transparent' }]} />}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ─── Orchestration Document Root ─────────────────────────────────────────────
export default function JobTicketDocument({ order, qrDataUrl, jobUrl }) {
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
                    <ImpositionLayoutsPage order={order} />
                    <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                        `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                    )} />
                </Page>
            )}
        </Document>
    );
}