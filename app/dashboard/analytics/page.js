'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { FiRefreshCw, FiArrowRight, FiTrendingUp, FiDollarSign, FiFileText,
    FiShoppingCart, FiBarChart2, FiActivity, FiClock, FiX, FiUsers,
    FiPackage, FiAlertTriangle } from 'react-icons/fi';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function fmtCurrency(n=0){ return new Intl.NumberFormat(undefined,{style:'currency',currency:'LKR',maximumFractionDigits:0}).format(n); }
function fmt(n=0){ if(n>=1e6) return `${(n/1e6).toFixed(1)}M`; if(n>=1000) return `${(n/1000).toFixed(1)}K`; return Number(n).toLocaleString(); }
function timeAgo(d){ const days=Math.floor((Date.now()-new Date(d))/86400000); if(days===0) return 'Today'; if(days===1) return 'Yesterday'; return `${days}d ago`; }
function pct(a,b){ return b?((a/b)*100).toFixed(1):'0.0'; }

const TT = { backgroundColor:'rgba(8,8,8,0.95)', borderColor:'rgba(255,255,255,0.08)', textStyle:{color:'#fff',fontSize:12} };

function Skel({h='h-8',w='w-full'}){ return <div className={`${h} ${w} rounded-xl bg-white/[0.03] animate-pulse`} />; }

function KpiCard({icon:Icon,label,value,sub,danger,href}){
    const inner = (
        <div className={`bg-black/40 backdrop-blur-xl border ${danger?'border-red-500/20':'border-white/[0.07]'} rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.03] transition-all`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-2">{label}</p>
                    <p className={`text-2xl font-bold tracking-tight ${danger?'text-red-400':'text-white'}`}>{value}</p>
                    {sub && <p className={`text-xs mt-1 ${danger?'text-red-400/50':'text-white/30'}`}>{sub}</p>}
                </div>
                <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${danger?'bg-red-500/10 border-red-500/20':'bg-white/[0.04] border-white/[0.06]'}`}>
                    <Icon className={`w-4 h-4 ${danger?'text-red-400':'text-white/50'}`} />
                </div>
            </div>
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionCard({title,sub,href,hrefLabel,children}){
    return (
        <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                <div>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
                </div>
                {href && <Link href={href} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/70 transition-colors">{hrefLabel||'View all'} <FiArrowRight className="w-3 h-3"/></Link>}
            </div>
            {children}
        </div>
    );
}

const TABS = [
    { id:'overview',    label:'Overview' },
    { id:'finance',     label:'Finance & Profit' },
    { id:'production',  label:'Production' },
    { id:'inventory',   label:'Inventory' },
];

export default function AnalyticsPage() {
    const [tab, setTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [machines, setMachines] = useState([]);
    const [machPerf, setMachPerf] = useState({});
    const [machLoading, setMachLoading] = useState(true);
    const [perfMachine, setPerfMachine] = useState(null);
    const [perfData, setPerfData] = useState(null);
    const [perfLoading, setPerfLoading] = useState(false);
    const chartRef = useRef(null);
    const chartInst = useRef(null);

    const load = useCallback(async()=>{
        setLoading(true);
        try{ const r=await fetch('/api/dashboard/stats'); if(r.ok) setStats(await r.json()); }
        finally{ setLoading(false); setLastRefresh(new Date()); }
    },[]);

    const loadMachines = useCallback(async()=>{
        setMachLoading(true);
        try{
            const list = await fetch('/api/machines').then(r=>r.json());
            if(!Array.isArray(list)) return;
            setMachines(list);
            const results = await Promise.allSettled(list.map(m=>fetch(`/api/machines/${m.id}/performance`).then(r=>r.json()).then(d=>[m.id,d])));
            const map={};
            results.forEach(r=>{ if(r.status==='fulfilled'){ const [id,d]=r.value; map[id]=d; } });
            setMachPerf(map);
        }catch(e){console.error(e);}
        finally{setMachLoading(false);}
    },[]);

    const openPerf = useCallback(async(m)=>{
        setPerfMachine(m);
        if(machPerf[m.id]){ setPerfData(machPerf[m.id]); return; }
        setPerfData(null); setPerfLoading(true);
        try{ const d=await fetch(`/api/machines/${m.id}/performance`).then(r=>r.json()); setPerfData(d); }
        catch{}finally{ setPerfLoading(false); }
    },[machPerf]);

    useEffect(()=>{
        if(!perfData?.monthly?.length||!chartRef.current) return;
        import('echarts').then(e=>{
            if(chartInst.current) chartInst.current.dispose();
            chartInst.current=e.init(chartRef.current,null,{renderer:'svg'});
            chartInst.current.setOption({
                backgroundColor:'transparent',
                tooltip:{trigger:'axis',backgroundColor:'#111',borderColor:'#333',textStyle:{color:'#ccc'}},
                grid:{left:10,right:10,top:10,bottom:30,containLabel:true},
                xAxis:{type:'category',data:perfData.monthly.map(m=>m.month),axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#555',fontSize:10}},
                yAxis:{type:'value',splitLine:{lineStyle:{color:'#1a1a1a'}},axisLabel:{color:'#555',fontSize:10}},
                series:[
                    {name:'Tasks Done',type:'bar',data:perfData.monthly.map(m=>m.tasks_done),itemStyle:{color:'rgba(255,255,255,0.4)',borderRadius:[4,4,0,0]}},
                    {name:'Avg Mins',type:'line',data:perfData.monthly.map(m=>m.avg_mins),lineStyle:{color:'rgba(255,255,255,0.2)'},itemStyle:{color:'rgba(255,255,255,0.3)'},smooth:true,symbol:'circle',symbolSize:5},
                ],
            });
        });
        return()=>{ if(chartInst.current){chartInst.current.dispose();chartInst.current=null;} };
    },[perfData]);

    useEffect(()=>{ load(); loadMachines(); },[load,loadMachines]);

    // ── Chart options ──────────────────────────────────────────────────────────
    const revenueOption = stats?.revenueByMonth?.length ? {
        backgroundColor:'transparent',
        tooltip:{trigger:'axis',...TT,formatter:p=>p.map(i=>`<span style="color:${i.color}">${i.seriesName}</span> <b>${fmtCurrency(i.value)}</b>`).join('<br/>')},
        legend:{data:['Billed','Collected'],textStyle:{color:'rgba(255,255,255,0.3)',fontSize:11},right:0},
        grid:{left:8,right:8,top:36,bottom:0,containLabel:true},
        xAxis:{type:'category',data:stats.revenueByMonth.map(r=>r.label),axisLine:{lineStyle:{color:'rgba(255,255,255,0.04)'}},axisTick:{show:false},axisLabel:{color:'rgba(255,255,255,0.25)',fontSize:10}},
        yAxis:{type:'value',axisLabel:{color:'rgba(255,255,255,0.25)',fontSize:10,formatter:v=>v>=1000?`${(v/1000).toFixed(0)}K`:v},splitLine:{lineStyle:{color:'rgba(255,255,255,0.04)'}}},
        series:[
            {name:'Billed',type:'bar',data:stats.revenueByMonth.map(r=>Number(r.billed)),barMaxWidth:36,itemStyle:{color:'rgba(255,255,255,0.08)',borderRadius:[4,4,0,0]}},
            {name:'Collected',type:'line',smooth:true,data:stats.revenueByMonth.map(r=>Number(r.collected)),lineStyle:{color:'rgba(255,255,255,0.7)',width:2},symbol:'circle',symbolSize:5,itemStyle:{color:'rgba(255,255,255,0.8)'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(255,255,255,0.1)'},{offset:1,color:'rgba(0,0,0,0)'}]}}},
        ],
    } : null;

    const makePie=(data,palette)=>({
        backgroundColor:'transparent',
        tooltip:{trigger:'item',...TT},
        legend:{orient:'vertical',right:10,top:'center',textStyle:{color:'rgba(255,255,255,0.35)',fontSize:11}},
        series:[{type:'pie',radius:['52%','80%'],center:['36%','50%'],avoidLabelOverlap:true,label:{show:false},emphasis:{label:{show:false}},
            data:data.map((s,i)=>({name:s.status,value:Number(s.count),itemStyle:{color:palette[i%palette.length]}}))}],
    });
    const PALETTE=['rgba(255,255,255,0.85)','rgba(255,255,255,0.55)','rgba(255,255,255,0.35)','rgba(255,255,255,0.20)','rgba(255,255,255,0.12)'];
    const invPie  = stats?.invoicesByStatus?.length  ? makePie(stats.invoicesByStatus, PALETTE)  : null;
    const quotPie = stats?.quotationsByStatus?.length ? makePie(stats.quotationsByStatus, PALETTE) : null;

    const topCustOption = stats?.topCustomers?.length ? {
        backgroundColor:'transparent',
        tooltip:{trigger:'axis',axisPointer:{type:'none'},...TT,formatter:p=>`<b>${p[0].name}</b><br/>${fmtCurrency(p[0].value)}`},
        grid:{left:0,right:20,top:4,bottom:0,containLabel:true},
        xAxis:{type:'value',show:false},
        yAxis:{type:'category',data:stats.topCustomers.map(c=>c.customer_name).reverse(),axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'rgba(255,255,255,0.4)',fontSize:11}},
        series:[{type:'bar',data:stats.topCustomers.map(c=>Number(c.revenue)).reverse(),barMaxWidth:18,
            itemStyle:{color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:'rgba(255,255,255,0.06)'},{offset:1,color:'rgba(255,255,255,0.45)'}]},borderRadius:[0,6,6,0]},
            label:{show:true,position:'right',color:'rgba(255,255,255,0.3)',fontSize:10,formatter:p=>fmt(p.value)}}],
    } : null;

    const profitTrendOption = stats?.profitByMonth?.length ? {
        backgroundColor:'transparent',
        tooltip:{trigger:'axis',...TT,formatter:p=>`<b>${p[0]?.name}</b><br/>`+p.map(i=>`<span style="color:${i.color}">${i.seriesName}</span> <b>${fmtCurrency(i.value)}</b>`).join('<br/>')},
        legend:{data:['Production Cost','Markup Profit','Billed (ex-tax)'],textStyle:{color:'rgba(255,255,255,0.3)',fontSize:11},right:0},
        grid:{left:8,right:8,top:44,bottom:0,containLabel:true},
        xAxis:{type:'category',data:stats.profitByMonth.map(r=>r.label),axisLine:{lineStyle:{color:'rgba(255,255,255,0.04)'}},axisTick:{show:false},axisLabel:{color:'rgba(255,255,255,0.25)',fontSize:11}},
        yAxis:{type:'value',axisLabel:{color:'rgba(255,255,255,0.25)',fontSize:10,formatter:v=>v>=1000?`${(v/1000).toFixed(0)}K`:v},splitLine:{lineStyle:{color:'rgba(255,255,255,0.04)'}}},
        series:[
            {name:'Production Cost',type:'bar',stack:'total',data:stats.profitByMonth.map(r=>r.cost),barMaxWidth:44,itemStyle:{color:'rgba(255,255,255,0.10)',borderRadius:[0,0,4,4]}},
            {name:'Markup Profit',type:'bar',stack:'total',data:stats.profitByMonth.map(r=>r.profit),barMaxWidth:44,itemStyle:{color:'rgba(255,255,255,0.40)',borderRadius:[4,4,0,0]},label:{show:true,position:'top',color:'rgba(255,255,255,0.5)',fontSize:10,formatter:p=>p.value>0?fmtCurrency(p.value):''}},
            {name:'Billed (ex-tax)',type:'line',smooth:true,data:stats.profitByMonth.map(r=>r.billed),lineStyle:{color:'rgba(255,255,255,0.55)',width:2,type:'dashed'},symbol:'circle',symbolSize:5,itemStyle:{color:'rgba(255,255,255,0.7)'}},
        ],
    } : null;

    const custProfitRows = stats?.profitRows ? Object.values(
        stats.profitRows.reduce((acc,r)=>{
            if(!acc[r.customer_name]) acc[r.customer_name]={customer:r.customer_name,profit:0,billed:0,cost:0,jobs:0};
            acc[r.customer_name].profit+=r.markup_profit; acc[r.customer_name].billed+=r.total_billed_ex_tax;
            acc[r.customer_name].cost+=r.total_cost; acc[r.customer_name].jobs+=r.so_count;
            return acc;
        },{})
    ).sort((a,b)=>b.profit-a.profit).slice(0,8) : [];

    const custProfitOption = custProfitRows.length ? {
        backgroundColor:'transparent',
        tooltip:{trigger:'axis',axisPointer:{type:'none'},...TT,formatter:p=>{ const row=custProfitRows.find(r=>r.customer===p[0]?.name)||{}; return `<b>${p[0]?.name}</b><br/>Profit: <b>${fmtCurrency(row.profit)}</b><br/>Margin: ${pct(row.profit,row.cost)}%`; }},
        grid:{left:0,right:80,top:4,bottom:0,containLabel:true},
        xAxis:{type:'value',show:false},
        yAxis:{type:'category',data:custProfitRows.map(r=>r.customer).reverse(),axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'rgba(255,255,255,0.45)',fontSize:11}},
        series:[{type:'bar',data:custProfitRows.map(r=>r.profit).reverse(),barMaxWidth:18,
            itemStyle:{color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:'rgba(255,255,255,0.06)'},{offset:1,color:'rgba(255,255,255,0.45)'}]},borderRadius:[0,6,6,0]},
            label:{show:true,position:'right',color:'rgba(255,255,255,0.35)',fontSize:10,formatter:p=>fmt(p.value)}}],
    } : null;

    const scatterOption = stats?.profitRows?.length ? {
        backgroundColor:'transparent',
        tooltip:{trigger:'item',...TT,formatter:p=>{ const[cost,margin]=p.data; return `<b>${p.name}</b><br/>Cost: ${fmtCurrency(cost)}<br/>Margin: ${margin}%`; }},
        grid:{left:8,right:8,top:8,bottom:0,containLabel:true},
        xAxis:{type:'value',name:'Cost (LKR)',nameTextStyle:{color:'rgba(255,255,255,0.2)',fontSize:10},axisLabel:{color:'rgba(255,255,255,0.25)',fontSize:10,formatter:v=>fmt(v)},splitLine:{lineStyle:{color:'rgba(255,255,255,0.04)'}}},
        yAxis:{type:'value',name:'Margin %',nameTextStyle:{color:'rgba(255,255,255,0.2)',fontSize:10},axisLabel:{color:'rgba(255,255,255,0.25)',fontSize:10,formatter:v=>`${v}%`},splitLine:{lineStyle:{color:'rgba(255,255,255,0.04)'}}},
        series:[{type:'scatter',data:stats.profitRows.map(r=>({name:`${r.quotation_code} — ${r.customer_name}`,value:[r.total_cost,r.margin_pct]})),symbolSize:10,itemStyle:{color:'rgba(255,255,255,0.55)',borderColor:'rgba(255,255,255,0.15)',borderWidth:1},emphasis:{itemStyle:{color:'#fff',borderWidth:0}}}],
    } : null;


    // ── Divider label ──────────────────────────────────────────────────────────
    const Divider = ({label}) => (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.05]"/>
            <span className="text-[11px] font-semibold text-white/25 uppercase tracking-widest px-2">{label}</span>
            <div className="flex-1 h-px bg-white/[0.05]"/>
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <p className="text-white/25 text-sm mb-1">Reports</p>
                    <h1 className="text-3xl font-bold tracking-tighter text-white flex items-center gap-3">
                        <FiBarChart2 className="w-7 h-7 text-white/40"/> Analytics
                    </h1>
                </div>
                <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/15 text-white/35 hover:text-white/70 text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-30 cursor-pointer w-fit">
                    <FiRefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/>
                    {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : 'Refresh'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
                {TABS.map(t=>(
                    <button key={t.id} onClick={()=>setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.id?'bg-white/[0.08] text-white border border-white/[0.10]':'text-white/35 hover:text-white/60'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══ TAB: OVERVIEW ══════════════════════════════════════════════════════════ */}
            {tab==='overview' && (<>
                <Divider label="Key Performance Indicators"/>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {loading ? Array(8).fill(0).map((_,i)=>(
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-20"/><Skel h="h-7" w="w-28"/></div>
                    )) : stats ? (<>
                        <KpiCard icon={FiDollarSign}    label="Total Revenue"        value={fmtCurrency(stats.kpi.totalRevenue)}       sub="All-time invoiced"              href="/dashboard/invoices"/>
                        <KpiCard icon={FiTrendingUp}    label="Collected This Month"  value={fmtCurrency(stats.kpi.collectedThisMonth)} sub="Payments received"              href="/dashboard/invoices"/>
                        <KpiCard icon={FiClock}         label="Outstanding"           value={fmtCurrency(stats.kpi.outstanding)}        sub="Awaiting payment"               href="/dashboard/invoices?status=sent"/>
                        <KpiCard icon={FiAlertTriangle} label="Overdue"               value={fmtCurrency(stats.kpi.overdue)}            sub="Past due date"                  href="/dashboard/invoices?status=overdue" danger={stats.kpi.overdue>0}/>
                        <KpiCard icon={FiFileText}      label="Quotations"            value={fmt(stats.kpi.totalQuotations)}            sub={`${stats.kpi.acceptedQuotations} accepted`} href="/dashboard/quotations"/>
                        <KpiCard icon={FiShoppingCart}  label="Sales Orders"          value={fmt(stats.kpi.totalSalesOrders)}           sub="All time"                       href="/dashboard/sales-orders"/>
                        <KpiCard icon={FiUsers}         label="Customers"             value={fmt(stats.kpi.totalCustomers)}             sub={`+${stats.kpi.newCustomers} this month`} href="/dashboard/customers"/>
                        <KpiCard icon={FiPackage}       label="Inventory Items"       value={fmt(stats.kpi.totalItems)}                 sub={stats.kpi.lowStockCount>0?`${stats.kpi.lowStockCount} low stock`:'All in stock'} href="/dashboard/inventory" danger={stats.kpi.lowStockCount>0}/>
                    </>) : null}
                </div>

                <Divider label="Revenue"/>
                <SectionCard title="Revenue — Last 6 Months" href="/dashboard/invoices" hrefLabel="All invoices">
                    <div className="p-4">
                        {loading ? <Skel h="h-52"/> : revenueOption ? <ReactECharts option={revenueOption} style={{height:220}}/> : <p className="text-center text-white/20 py-14 text-sm">No revenue data yet.</p>}
                    </div>
                </SectionCard>

                <div className="grid lg:grid-cols-2 gap-4">
                    <SectionCard title="Invoices by Status">
                        <div className="p-4">{loading?<Skel h="h-44"/>:invPie?<ReactECharts option={invPie} style={{height:180}}/>:<p className="text-center text-white/20 py-10 text-sm">No data.</p>}</div>
                    </SectionCard>
                    <SectionCard title="Quotations by Status">
                        <div className="p-4">{loading?<Skel h="h-44"/>:quotPie?<ReactECharts option={quotPie} style={{height:180}}/>:<p className="text-center text-white/20 py-10 text-sm">No data.</p>}</div>
                    </SectionCard>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <SectionCard title="Top Customers by Revenue" href="/dashboard/customers">
                        <div className="p-4">{loading?<Skel h="h-52"/>:topCustOption?<ReactECharts option={topCustOption} style={{height:200}}/>:<p className="text-center text-white/20 py-10 text-sm">No data.</p>}</div>
                    </SectionCard>
                    <SectionCard title="Recent Invoices" href="/dashboard/invoices">
                        {loading ? <div className="p-4 space-y-3">{Array(4).fill(0).map((_,i)=><Skel key={i} h="h-11"/>)}</div>
                        : stats?.recentInvoices?.length ? (
                            <div className="divide-y divide-white/[0.04]">
                                {stats.recentInvoices.map((inv,i)=>(
                                    <div key={i} className="flex items-center justify-between px-5 py-3.5 gap-3 hover:bg-white/[0.02] transition-colors">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{inv.customer_name}</p>
                                            <p className="text-xs text-white/25 font-mono">{inv.code} · {timeAgo(inv.created_at)}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-semibold text-white font-mono">{fmtCurrency(inv.amount_due)}</p>
                                            <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-white/[0.04] text-white/40 border-white/[0.08]">{inv.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-center text-white/20 py-10 text-sm">No invoices yet.</p>}
                    </SectionCard>
                </div>
            </>)}

            {/* ══ TAB: FINANCE & PROFIT ══════════════════════════════════════════════════ */}
            {tab==='finance' && (<>
                <Divider label="Profit KPIs — Converted Quotations"/>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {loading ? Array(4).fill(0).map((_,i)=>(
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-20"/><Skel h="h-7" w="w-28"/></div>
                    )) : stats?.profitKpi ? (<>
                        <KpiCard icon={FiDollarSign}   label="Production Cost"   value={fmtCurrency(stats.profitKpi.totalCost)}   sub={`${stats.profitRows?.length??0} converted jobs`}/>
                        <KpiCard icon={FiShoppingCart} label="Billed (ex-tax)"   value={fmtCurrency(stats.profitKpi.totalBilled)} sub="Before tax"/>
                        <KpiCard icon={FiTrendingUp}   label="Markup Profit"     value={fmtCurrency(stats.profitKpi.totalProfit)} sub="Billed − production cost"/>
                        <KpiCard icon={FiFileText}     label="Avg Profit Margin" value={`${stats.profitKpi.avgMarginPct}%`}       sub="On cost basis"/>
                    </>) : null}
                </div>

                <Divider label="Trends"/>
                <SectionCard title="Monthly Profit Trend" sub="Cost vs markup profit (stacked) + billed line — last 6 months">
                    <div className="p-4">{loading?<Skel h="h-64"/>:profitTrendOption?<ReactECharts option={profitTrendOption} style={{height:280}}/>:<p className="text-center text-white/20 py-16 text-sm">No data in last 6 months.</p>}</div>
                </SectionCard>

                <div className="grid lg:grid-cols-2 gap-4">
                    <SectionCard title="Customer Profitability" sub="Markup profit per customer (top 8)">
                        <div className="p-4">{loading?<Skel h="h-52"/>:custProfitOption?<ReactECharts option={custProfitOption} style={{height:220}}/>:<p className="text-center text-white/20 py-12 text-sm">No data.</p>}</div>
                    </SectionCard>
                    <SectionCard title="Cost vs Margin Scatter" sub="Each dot = one converted quotation">
                        <div className="p-4">{loading?<Skel h="h-52"/>:scatterOption?<ReactECharts option={scatterOption} style={{height:220}}/>:<p className="text-center text-white/20 py-12 text-sm">No data.</p>}</div>
                    </SectionCard>
                </div>

                <Divider label="Quotation Breakdown"/>
                <SectionCard title="Quotation Profit Breakdown" sub="Only quotations converted to a sales order" href="/dashboard/quotations" hrefLabel="All quotations">
                    {loading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_,i)=><Skel key={i} h="h-12"/>)}</div>
                    : stats?.profitRows?.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                                        {['Quotation','Customer','Date','Production Cost','Billed (ex-tax)','Markup Profit','Markup %','Margin'].map(h=>(
                                            <th key={h} className={`px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider ${h==='Quotation'||h==='Customer'?'text-left':'text-right'} ${h==='Margin'?'text-left':''}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {stats.profitRows.map(row=>{
                                        const maxP=Math.max(...stats.profitRows.map(r=>r.markup_profit));
                                        const bar=maxP>0?(row.markup_profit/maxP)*100:0;
                                        return (
                                            <tr key={row.quotation_id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-4 py-3.5"><Link href={`/dashboard/quotations/${row.quotation_id}`} className="font-mono text-xs font-semibold text-white/60 hover:text-white">{row.quotation_code}</Link></td>
                                                <td className="px-4 py-3.5 text-sm text-white font-medium">{row.customer_name}</td>
                                                <td className="px-4 py-3.5 text-xs text-white/30 text-right">{timeAgo(row.created_at)}</td>
                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-white/55">{fmtCurrency(row.total_cost)}</td>
                                                <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold text-white">{fmtCurrency(row.total_billed_ex_tax)}</td>
                                                <td className="px-4 py-3.5 text-right"><span className={`font-mono font-bold text-sm ${row.markup_profit>0?'text-white':'text-red-400'}`}>{fmtCurrency(row.markup_profit)}</span></td>
                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-white/50">{row.avg_markup_pct}%</td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden min-w-[60px]">
                                                            <div className="h-full bg-white/40 rounded-full" style={{width:`${bar}%`}}/>
                                                        </div>
                                                        <span className="text-[11px] text-white/35 font-mono w-10 text-right shrink-0">{row.margin_pct}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                                        <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-white/35 uppercase tracking-wider">Total / Average</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-white/55">{fmtCurrency(stats.profitKpi.totalCost)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-white">{fmtCurrency(stats.profitKpi.totalBilled)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">{fmtCurrency(stats.profitKpi.totalProfit)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm text-white/35">—</td>
                                        <td className="px-4 py-3"><span className="text-[11px] font-bold text-white/45 font-mono">{stats.profitKpi.avgMarginPct}% avg</span></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <FiBarChart2 className="w-8 h-8 text-white/10"/>
                            <p className="text-white/25 text-sm">No converted quotations yet.</p>
                        </div>
                    )}
                </SectionCard>
            </>)}


            {/* ══ TAB: PRODUCTION ════════════════════════════════════════════════════════ */}
            {tab==='production' && (<>
                <Divider label="Machine Performance Overview"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {machLoading ? Array(4).fill(0).map((_,i)=>(
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-24"/><Skel h="h-6" w="w-16"/><Skel h="h-2"/></div>
                    )) : machines.length===0 ? (
                        <p className="col-span-full text-white/20 text-sm text-center py-8">No machines found.</p>
                    ) : machines.map(m=>{
                        const p=machPerf[m.id]?.summary;
                        const pct2=p?.total_tasks>0?Math.round(p.completed/p.total_tasks*100):0;
                        const running=machPerf[m.id]?.currentTask!=null;
                        return (
                            <button key={m.id} onClick={()=>openPerf(m)}
                                className="group text-left bg-black/40 backdrop-blur-xl border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-5 transition-all hover:bg-white/[0.03] cursor-pointer">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                                        <p className="text-[11px] text-white/30 capitalize mt-0.5">{m.type}</p>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-1.5">
                                        {running && <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse"/>}
                                        <FiBarChart2 className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors"/>
                                    </div>
                                </div>
                                {p ? (<>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div><p className="text-[9px] font-bold text-white/20 uppercase tracking-wider">Completed</p><p className="text-lg font-bold text-white mt-0.5">{p.completed}</p></div>
                                        <div><p className="text-[9px] font-bold text-white/20 uppercase tracking-wider">Avg Time</p><p className="text-lg font-bold text-white mt-0.5">{p.avg_active_mins?`${p.avg_active_mins}m`:'—'}</p></div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] text-white/25 mb-1"><span>{p.completed}/{p.total_tasks} tasks</span><span>{pct2}%</span></div>
                                        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden"><div className="h-full bg-white/35 rounded-full" style={{width:`${pct2}%`}}/></div>
                                    </div>
                                    {running && <p className="text-[10px] text-white/35 mt-2 flex items-center gap-1"><FiActivity className="w-2.5 h-2.5"/> Running now</p>}
                                </>) : <p className="text-xs text-white/20 mt-1">No tasks assigned</p>}
                            </button>
                        );
                    })}
                </div>
            </>)}

            {/* ══ TAB: INVENTORY ═════════════════════════════════════════════════════════ */}
            {tab==='inventory' && (<>
                <Divider label="Stock Levels"/>
                <div className="grid lg:grid-cols-3 gap-3">
                    {loading ? Array(3).fill(0).map((_,i)=>(
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-20"/><Skel h="h-7" w="w-28"/></div>
                    )) : stats ? (<>
                        <KpiCard icon={FiPackage}       label="Inventory Items"   value={fmt(stats.kpi.totalItems)}      sub="Total tracked items"    href="/dashboard/inventory"/>
                        <KpiCard icon={FiAlertTriangle} label="Low Stock Items"   value={fmt(stats.kpi.lowStockCount)}   sub="Below minimum level"    href="/dashboard/inventory" danger={stats.kpi.lowStockCount>0}/>
                        <KpiCard icon={FiPackage}       label="Well Stocked"      value={fmt(stats.kpi.totalItems - stats.kpi.lowStockCount)} sub="Items above minimum"/>
                    </>) : null}
                </div>

                <Divider label="Alerts"/>
                <SectionCard title="Low Stock Alerts" sub="Items below minimum stock level" href="/dashboard/inventory">
                    {loading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_,i)=><Skel key={i} h="h-11"/>)}</div>
                    : stats?.lowStock?.length ? (
                        <div className="divide-y divide-white/[0.04]">
                            {stats.lowStock.map((item,i)=>(
                                <div key={i} className="flex items-center justify-between px-5 py-4 gap-3 hover:bg-white/[0.02] transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                                        <p className="text-xs text-white/25 mt-0.5">Minimum: {item.min_stock} {item.uom}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className="font-mono font-bold text-red-400 text-lg">{item.stock_quantity}</span>
                                        <p className="text-[10px] text-white/25">{item.uom}</p>
                                    </div>
                                    <div className="w-24">
                                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                            <div className="h-full bg-red-400/50 rounded-full" style={{width:`${Math.min(100,item.min_stock>0?(item.stock_quantity/item.min_stock)*100:0)}%`}}/>
                                        </div>
                                        <p className="text-[10px] text-white/20 mt-1 text-right">{item.min_stock>0?Math.round((item.stock_quantity/item.min_stock)*100):0}% of min</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <FiPackage className="w-8 h-8 text-white/10"/>
                            <p className="text-white/25 text-sm">All items are well stocked.</p>
                        </div>
                    )}
                </SectionCard>
            </>)}

            {/* ══ Machine Performance Slide-in Panel (shared) ════════════════════════════ */}
            {perfMachine && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={()=>{setPerfMachine(null);setPerfData(null);}}/>
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border-l border-white/[0.08] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center"><FiActivity className="w-4 h-4 text-white/50"/></div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{perfMachine.name}</p>
                                    <p className="text-xs text-white/30 capitalize">{perfMachine.type} · Performance Analytics</p>
                                </div>
                            </div>
                            <button onClick={()=>{setPerfMachine(null);setPerfData(null);}} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-all"><FiX/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                            {(perfLoading&&!machPerf[perfMachine?.id]) ? (
                                <div className="flex items-center justify-center py-20"><div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin"/></div>
                            ) : (()=>{
                                const d=perfData||machPerf[perfMachine?.id];
                                if(!d) return <p className="text-center text-white/25 text-sm py-12">No analytics data available.</p>;
                                const s=d.summary;
                                return (<>
                                    {d.currentTask && (
                                        <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FiActivity className="w-3 h-3"/>Currently Running</p>
                                            <p className="text-sm font-semibold text-white">{d.currentTask.name}</p>
                                            <p className="text-xs text-white/40 mt-0.5">{d.currentTask.order_code} · {d.currentTask.customer_name}</p>
                                            {d.currentTask.started_at && <p className="text-xs text-white/30 mt-1 flex items-center gap-1"><FiClock className="w-3 h-3"/>Started {new Date(d.currentTask.started_at).toLocaleString()}</p>}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[['Total Tasks',s.total_tasks,'assigned'],['Completed',s.completed,`${s.total_tasks>0?Math.round(s.completed/s.total_tasks*100):0}% done`],['Avg Active',s.avg_active_mins?`${s.avg_active_mins}m`:'—','started → done'],['Total Hours',s.total_active_mins?`${Math.round(s.total_active_mins/60)}h`:'—','machine hours']].map(([label,value,sub])=>(
                                            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-2">{label}</p>
                                                <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
                                                <p className="text-[11px] text-white/25 mt-1">{sub}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Task Status Breakdown</p>
                                        <div className="space-y-2">
                                            {[['Completed',s.completed,'bg-white/50'],['In Progress',s.in_progress,'bg-white/25'],['Pending',s.pending,'bg-white/10']].map(([label,count,bar])=>(
                                                <div key={label} className="flex items-center gap-3">
                                                    <span className="text-xs text-white/40 w-20 shrink-0">{label}</span>
                                                    <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className={`h-full ${bar} rounded-full`} style={{width:`${s.total_tasks>0?Math.round(count/s.total_tasks*100):0}%`}}/></div>
                                                    <span className="text-xs font-mono text-white/40 w-6 text-right">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {d.monthly?.length>0 && (
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Monthly Output (last 6 months)</p>
                                            <div ref={chartRef} style={{height:180}}/>
                                        </div>
                                    )}
                                    {d.recent?.length>0 && (
                                        <div>
                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Recent Completed Tasks</p>
                                            <div className="space-y-1.5">
                                                {d.recent.map(t=>(
                                                    <div key={t.id} className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                                                        <div className="min-w-0"><p className="text-sm font-medium text-white/70 truncate">{t.name}</p><p className="text-[11px] text-white/25 mt-0.5">{t.order_code} · {t.customer_name}</p></div>
                                                        <div className="text-right shrink-0">
                                                            {t.active_mins!=null?<p className="text-xs font-mono text-white/50">{t.active_mins}m active</p>:<p className="text-xs text-white/20">—</p>}
                                                            <p className="text-[10px] text-white/20 mt-0.5">{t.completed_at?new Date(t.completed_at).toLocaleDateString():''}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>);
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
