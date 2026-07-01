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
const fmtTime = t => (parseFloat(t) > 0 ? `${parseFloat(t).toFixed(1)} m` : '—');

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
const fmtFinishTime = f => {
    const qty   = parseFloat(f.quantity)  || 0;
    const speed = parseFloat(f.speed)     || 0;
    if (!qty || !speed) return fmtTime(f.total_time); // fallback to stored value
    const mins = Math.ceil((qty / speed) * 60);
    return mins < 60 ? `~${mins} min` : `~${(mins / 60).toFixed(1)} hr`;
};

function FinishingsTable({ finishings }) {
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
                <View key={i} style={s.tableRow}>
                    <Text style={[s.tableCellBold, s.tableCol1]}>{fmt(f.name)}</Text>
                    <Text style={[s.tableCell, s.tableCol2]}>{fmt(f.machine_name)}</Text>
                    <Text style={[s.tableCell, s.tableCol3]}>{fmt(f.quantity)} {fmt(f.cost_unit)}</Text>
                    <Text style={[s.tableCell, s.tableCol4]}>{fmtFinishTime(f)}</Text>
                </View>
            ))}
        </View>
    );
}

function GlobalFinishingsTable({ finishings }) {
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
                <View key={i} style={s.tableRow}>
                    <Text style={[s.tableCellBold, s.tableCol1]}>{fmt(f.name)}</Text>
                    <Text style={[s.tableCell, s.tableCol3]}>{fmt(f.quantity)} {fmt(f.cost_unit)}</Text>
                    <Text style={[s.tableCell, s.tableCol4]}>{fmtFinishTime(f)}</Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <View style={s.globalBox} />
                    </View>
                </View>
            ))}
        </View>
    );
}

function DetailCard({ detail }) {
    const isFinishing = detail.component_name === 'Finishing';
    const isDigital = detail.type === 'digital';

    // Est. press time: (printed_sheets + wastage_sheets) × sides / machine_speed (hrs → min)
    const cutSheets = (parseFloat(detail.printed_sheets) || 0) + (parseFloat(detail.wastage_sheets) || 0);
    const pressPasses = cutSheets * (detail.sides || 1);
    const estMins = detail.machine_speed > 0
        ? Math.ceil((pressPasses / detail.machine_speed) * 60)
        : null;
    const estTimeLabel = estMins != null
        ? estMins < 60
            ? `~${estMins} min`
            : `~${(estMins / 60).toFixed(1)} hr`
        : null;

    return (
        <View style={s.detailCard}>
            <Text style={s.detailBadge}>{detail.component_name} / {detail.type}</Text>

            {!isFinishing && (
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
                            <Text style={s.paperBoxValue}>{fmt(detail.printed_sheets + detail.wastage_sheets)}</Text>
                            <Text style={[s.paperBoxSub, { fontSize: 6.5, color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>
                                ({fmt(detail.printed_sheets)} + {fmt(detail.wastage_sheets)} wst)
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

            <FinishingsTable finishings={detail.finishings} />
        </View>
    );
}


// ─── Form Page 1 Components (Portrait) ───────────────────────────────────────
function JobTicketPage({ order, qrDataUrl, jobUrl }) {
    const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString() : '—';
    const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'TBD';

    return (
        <View style={{ flex: 1, paddingBottom: 20 }}>
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

            {order.items?.map((item, idx) => (
                <View key={item.id || idx} style={s.itemBlock}>
                    <View style={s.itemHeader}>
                        <Text style={s.itemHeaderText}>{idx + 1}. {item.estimation_name || item.job_description}</Text>
                        <Text style={s.itemHeaderText}>Target Yield: {item.quantity} Units</Text>
                    </View>

                    {item.details?.map((detail, dIdx) => (
                        <DetailCard key={detail.id || dIdx} detail={detail} />
                    ))}

                    <GlobalFinishingsTable finishings={item.globalFinishings} />

                    <View style={s.signoffRow}>
                        <View style={s.signoffBox}>
                            <Text style={s.signoffText}>Floor Controller Sign-Off</Text>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}

// ─── Form Page 2 Components (Landscape) ──────────────────────────────────────
function ImpositionLayoutsPage({ order }) {
    const layouts = [];
    order.items?.forEach((item, itemIdx) => {
        item.details
            ?.filter(d => d.type !== 'digital' && d.comp_width_cm && d.comp_height_cm && d.component_name !== 'Finishing')
            .forEach((detail, dIdx) => {
                layouts.push({ item, itemIdx, detail, dIdx });
            });
    });

    if (!layouts.length) return null;

    return (
        <View style={{ flex: 1, paddingBottom: 20 }}>
            <View style={s.headerRow}>
                <View style={s.headerLeft}>
                    <Text style={s.headerTitle}>Imposition & Layout Allocation Plans</Text>
                    <Text style={s.headerSub}>{order.customer_name} — Layout Master Specifications</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.headerSOLabel}>Job Reference</Text>
                    <Text style={[s.headerSOCode, { fontSize: 12 }]}>{order.code}</Text>
                </View>
            </View>

            <View style={s.layoutGrid}>
                {Array.from({ length: Math.ceil(layouts.length / 2) }, (_, rowIdx) => {
                    const pair = layouts.slice(rowIdx * 2, rowIdx * 2 + 2);
                    return (
                        <View key={rowIdx} style={s.layoutRow}>
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
    
    return (
        <Document title={`JobTicket-${order.code}`} author="Pressmatics ERP Architecture">
            {/* Page Type 1: Job Details (Landscape for wide component spec tables) */}
            <Page size="A4" orientation="landscape" style={s.pageLandscape}>
                <JobTicketPage order={order} qrDataUrl={qrDataUrl} jobUrl={jobUrl} />
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Auto-Generated via Pressmatics Cloud ERP • Printed: ${timestamp} • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>

            {/* Page Type 2: Imposition Matrix Plans (Flipped Horizontal for Blueprint Wide Grids) */}
            <Page size="A4" orientation="landscape" style={s.pageLandscape}>
                <ImpositionLayoutsPage order={order} />
                <Text style={s.footer} render={({ pageNumber, totalPages }) => (
                    `Auto-Generated via Pressmatics Cloud ERP • Imposition Layout Scheme • Page ${pageNumber} of ${totalPages}`
                )} />
            </Page>
        </Document>
    );
}