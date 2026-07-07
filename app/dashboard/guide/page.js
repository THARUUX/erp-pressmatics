'use client';
import { useState } from 'react';
import {
    FiHome, FiFileText, FiShoppingCart, FiDollarSign,
    FiPrinter, FiBox, FiCalendar, FiBarChart2, FiTarget,
    FiUsers, FiSettings, FiLayers, FiTool, FiMap,
    FiAlertTriangle, FiInfo, FiZap, FiBookOpen, FiPackage,
    FiTrendingUp, FiClipboard, FiClock, FiRefreshCw,
    FiAward, FiCheck, FiCopy, FiPercent, FiMonitor,
    FiLayout, FiGlobe, FiList, FiUser, FiMaximize2,
    FiGrid, FiCpu, FiUpload, FiFlag, FiCheckSquare,
    FiPlay, FiSmartphone, FiActivity, FiSearch,
    FiArrowRight, FiArrowDown, FiGitMerge, FiDatabase,
    FiTruck, FiCornerDownRight, FiChevronRight, FiShuffle,
} from 'react-icons/fi';

const TABS = [
  { id: 'overview',    label: 'Overview',    Icon: FiMap },
  { id: 'flow',        label: 'System Flow', Icon: FiShuffle },
  { id: 'sales',       label: 'Sales Flow',  Icon: FiTrendingUp },
  { id: 'estimations', label: 'Estimations', Icon: FiPrinter },
  { id: 'inventory',   label: 'Inventory',   Icon: FiPackage },
  { id: 'production',  label: 'Production',  Icon: FiCpu },
  { id: 'tips',        label: 'Pro Tips',    Icon: FiZap },
];

function IconBox({ icon: Icon, accent }) {
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}20`, border: `1px solid ${accent}35` }}>
      <Icon className="w-5 h-5" style={{ color: accent }} />
    </div>
  );
}

function Badge({ color, children }) {
  const colors = {
    blue:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
    red:    'bg-red-500/15 text-red-300 border-red-500/30',
    cyan:   'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

function Card({ icon: Icon, title, accent = '#6366f1', children }) {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${accent}18`,
      }}>
      <div className="flex items-center gap-3">
        <IconBox icon={Icon} accent={accent} />
        <h3 className="font-semibold text-white text-sm leading-tight">{title}</h3>
      </div>
      <div className="text-sm text-white/60 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[11px] font-bold text-white/60 shrink-0 mt-0.5">{n}</div>
      <p className="text-sm text-white/65 leading-relaxed">{children}</p>
    </div>
  );
}

function Warning({ children }) {
  return (
    <div className="flex gap-3 items-start rounded-xl px-4 py-3"
      style={{ background: 'rgba(239,68,68,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(239,68,68,0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <FiAlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm text-red-300 leading-relaxed">{children}</p>
    </div>
  );
}

function Info({ children }) {
  return (
    <div className="flex gap-3 items-start rounded-xl px-4 py-3"
      style={{ background: 'rgba(14,165,233,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <FiInfo className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
      <p className="text-sm text-blue-200 leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ children }) {
  return (
    <div className="flex gap-3 items-start rounded-xl px-4 py-3"
      style={{ background: 'rgba(245,158,11,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(245,158,11,0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <FiZap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-200 leading-relaxed">{children}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="text-lg font-bold text-white mt-2 mb-4 flex items-center gap-2">
      {Icon && <Icon className="w-5 h-5 text-white/40" />}
      {children}
    </h2>
  );
}

/* ── Flow Diagram helpers ─────────────────────────────────────────────────── */
const FN_STYLES = {
  indigo:  { bg:'rgba(99,102,241,0.15)',  bd:'rgba(99,102,241,0.4)',  tx:'#a5b4fc' },
  sky:     { bg:'rgba(14,165,233,0.15)',  bd:'rgba(14,165,233,0.4)',  tx:'#7dd3fc' },
  emerald: { bg:'rgba(16,185,129,0.15)', bd:'rgba(16,185,129,0.4)',  tx:'#6ee7b7' },
  amber:   { bg:'rgba(245,158,11,0.15)', bd:'rgba(245,158,11,0.4)',  tx:'#fcd34d' },
  violet:  { bg:'rgba(139,92,246,0.15)', bd:'rgba(139,92,246,0.4)',  tx:'#c4b5fd' },
  cyan:    { bg:'rgba(6,182,212,0.15)',  bd:'rgba(6,182,212,0.4)',   tx:'#67e8f9' },
  rose:    { bg:'rgba(244,63,94,0.15)',  bd:'rgba(244,63,94,0.4)',   tx:'#fda4af' },
  lime:    { bg:'rgba(132,204,22,0.15)', bd:'rgba(132,204,22,0.4)',  tx:'#bef264' },
  orange:  { bg:'rgba(249,115,22,0.15)', bd:'rgba(249,115,22,0.4)', tx:'#fdba74' },
  pink:    { bg:'rgba(236,72,153,0.15)', bd:'rgba(236,72,153,0.4)', tx:'#f9a8d4' },
};
function FNode({ icon: Icon, label, color = 'indigo', sub }) {
  const s = FN_STYLES[color] || FN_STYLES.indigo;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="rounded-2xl px-4 py-3 flex flex-col items-center gap-1.5 min-w-[96px] transition-transform hover:scale-105"
        style={{ background: s.bg, border: `1px solid ${s.bd}`, boxShadow: `0 0 20px ${s.bg}` }}>
        <Icon className="w-4 h-4" style={{ color: s.tx }} />
        <span className="text-[11px] font-bold text-white text-center leading-tight whitespace-nowrap">{label}</span>
      </div>
      {sub && <span className="text-[9px] text-white/30 text-center max-w-[108px] leading-snug">{sub}</span>}
    </div>
  );
}
function FArrow({ label, color = 'rgba(255,255,255,0.2)', dir = 'down' }) {
  return dir === 'right' ? (
    <div className="flex items-center gap-0.5">
      <div className="h-px w-8" style={{ background: color }} />
      <svg width="5" height="8" viewBox="0 0 5 8"><path d="M5 4 L0 0 L0 8Z" fill={color}/></svg>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-0.5 my-0.5">
      <div className="w-px h-5" style={{ background: color }} />
      <svg width="8" height="5" viewBox="0 0 8 5"><path d="M4 5 L0 0 L8 0Z" fill={color}/></svg>
      {label && <span className="text-[9px] font-medium" style={{ color }}>{label}</span>}
    </div>
  );
}
function FLane({ title, color, children }) {
  return (
    <div className="rounded-2xl p-5" style={{ background:`${color}09`, border:`1px solid ${color}22` }}>
      <p className="text-[9px] font-bold uppercase tracking-widest mb-4" style={{ color }}>{title}</p>
      {children}
    </div>
  );
}

const CONTENT = {
  overview: (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-black/40 border border-white/25 p-8 text-center">
        <div className="flex justify-center mb-4"><FiPrinter className="w-12 h-12 text-white" /></div>
        <h2 className="text-2xl font-bold text-white mb-2">Pressmatics ERP</h2>
        <p className="text-white/50 text-sm max-w-xl mx-auto">An all-in-one print production management system — from customer quotations through to job scheduling, invoicing, and inventory control.</p>
      </div>

      <SectionTitle icon={FiGrid}>System Modules</SectionTitle>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: FiUser,         title: 'Customers',          accent: '#6366f1', desc: 'Manage your client database. Each customer links to their quotations, orders and invoices.' },
          { icon: FiFileText,     title: 'Quotations',         accent: '#0ea5e9', desc: 'Send formal price quotes to customers. Pull from existing estimations or create fresh ones.' },
          { icon: FiShoppingCart, title: 'Sales Orders',       accent: '#10b981', desc: 'Convert approved quotations into production orders. Automatically deducts inventory stock.' },
          { icon: FiDollarSign,   title: 'Invoices',           accent: '#f59e0b', desc: 'Generate invoices from sales orders. Track payment status and outstanding balances.' },
          { icon: FiPrinter,      title: 'Estimations / Items',accent: '#8b5cf6', desc: 'Multi-component cost estimations for print jobs. Handles offset, digital, and SFG components.' },
          { icon: FiPackage,      title: 'Inventory',          accent: '#06b6d4', desc: 'Track paper, plates, ink, SFG, and finished goods stock. Supports BOM and auto-deduction.' },
          { icon: FiCalendar,     title: 'Planning',           accent: '#ec4899', desc: 'Job scheduling and machine queue management for shop floor operators.' },
          { icon: FiBarChart2,    title: 'Analytics',          accent: '#f97316', desc: 'Revenue trends, top customers, cost breakdowns and business performance insights.' },
          { icon: FiTarget,       title: 'Competitor Analysis',accent: '#84cc16', desc: 'Compare your pricing against competitors. Export detailed PDF reports.' },
        ].map(m => (
          <Card key={m.title} icon={m.icon} title={m.title} accent={m.accent}>
            <p>{m.desc}</p>
          </Card>
        ))}
      </div>

      <SectionTitle icon={FiUsers}>User Roles</SectionTitle>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { role: 'Admin',    badge: 'purple', perms: 'Full access to all modules including Users and Settings.' },
          { role: 'Manager',  badge: 'blue',   perms: 'Access to Sales, Production, Inventory, and Intelligence modules.' },
          { role: 'Operator', badge: 'cyan',   perms: 'Access to Planning and Inventory Stock Items only.' },
        ].map(r => (
          <div key={r.role} className="rounded-xl bg-black/40 border border-white/[0.07] p-4 space-y-2">
            <Badge color={r.badge}>{r.role}</Badge>
            <p className="text-sm text-white/55">{r.perms}</p>
          </div>
        ))}
      </div>
    </div>
  ),

  flow: (() => {
    function Chip({ label, dim }) {
      return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${
          dim
            ? 'bg-white/[0.03] text-white/35 border-white/[0.08]'
            : 'bg-white/[0.07] text-white/70 border-white/[0.15]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dim ? 'bg-white/20' : 'bg-white/50'}`} />
          {label}
        </span>
      );
    }
    function ModuleCard({ icon: Icon, name, needs = [], creates = [], note }) {
      return (
        <div className="rounded-2xl p-4 flex flex-col gap-3 bg-white/[0.03] border border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.06] border border-white/10">
              <Icon className="w-4 h-4 text-white/60" />
            </div>
            <span className="font-bold text-sm text-white">{name}</span>
          </div>
          {note && <p className="text-[10px] text-white/25 -mt-1">{note}</p>}
          {needs.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1.5">Needs</p>
              <div className="flex flex-wrap gap-1">{needs.map(l => <Chip key={l} label={l} dim />)}</div>
            </div>
          )}
          {creates.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1.5">Creates / Updates</p>
              <div className="flex flex-wrap gap-1">{creates.map(l => <Chip key={l} label={l} />)}</div>
            </div>
          )}
        </div>
      );
    }
    function PipeStep({ n, icon: Icon, title, sub, children }) {
      return (
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.06] border border-white/10">
              <Icon className="w-4 h-4 text-white/60" />
            </div>
            <div className="w-px flex-1 mt-1 bg-gradient-to-b from-white/10 to-transparent" />
          </div>
          <div className="pb-6 flex-1">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Step {n}</span>
            <p className="font-bold text-white text-sm mb-0.5 mt-0.5">{title}</p>
            {sub && <p className="text-[11px] text-white/35 mb-2">{sub}</p>}
            {children}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-10">

        {/* Banner */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-7 text-center">
          <FiGitMerge className="w-8 h-8 text-white/25 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-1">System Flow Diagram</h2>
          <p className="text-white/35 text-sm max-w-lg mx-auto">How every module connects — what each module needs, what it creates, and how data flows through the ERP.</p>
        </div>

        {/* Pipeline Steps */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-6">Core Sales Pipeline</p>
          <PipeStep n={1} icon={FiUsers} title="Customers" sub="The starting point of every transaction.">
            <div className="flex flex-wrap gap-1">
              <Chip label="Linked to Estimations" /><Chip label="Linked to Quotations" /><Chip label="Outstanding Balance tracked" />
            </div>
          </PipeStep>
          <PipeStep n={2} icon={FiPrinter} title="Estimation" sub="Detailed cost calculation for a print job.">
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold mb-1">Needs</p>
            <div className="flex flex-wrap gap-1">
              <Chip label="Customers" dim /><Chip label="Machines" dim /><Chip label="Finishings" dim />
              <Chip label="SFG Items" dim /><Chip label="Statics" dim /><Chip label="Services" dim /><Chip label="RM" dim />
            </div>
          </PipeStep>
          <PipeStep n={3} icon={FiFileText} title="Quotation" sub="Formal priced quote sent to customer.">
            <div className="flex flex-wrap gap-1">
              <Chip label="Needs: Customers" dim /><Chip label="Needs: Estimations" dim />
            </div>
          </PipeStep>
          <PipeStep n={4} icon={FiShoppingCart} title="Sales Order" sub="Converts approved quotation into a production order.">
            <div className="mb-2">
              <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold mb-1">Needs</p>
              <div className="flex flex-wrap gap-1"><Chip label="Quotation" dim /><Chip label="Inventory stock check" dim /></div>
            </div>
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold mb-1">Automatically creates</p>
            <div className="flex flex-wrap gap-1">
              <Chip label="Task List" /><Chip label="BOM" /><Chip label="Routing" /><Chip label="Timeline" />
            </div>
          </PipeStep>
          <PipeStep n={5} icon={FiList} title="BOM (Bill of Materials)" sub="Deducts stock when Sales Order is created.">
            <div className="flex flex-wrap gap-1">
              <Chip label="Deducts Paper" /><Chip label="Deducts Plates" /><Chip label="Deducts SFG / RM" />
            </div>
          </PipeStep>
          <PipeStep n={6} icon={FiCalendar} title="Planning" sub="Machine scheduling for production tasks.">
            <div className="flex flex-wrap gap-1"><Chip label="Needs: Task List" dim /><Chip label="Uses: Machines" dim /></div>
          </PipeStep>
          <PipeStep n={7} icon={FiDollarSign} title="Invoices" sub="Generated from Sales Orders. Tracks payment status.">
            <div className="mb-2"><div className="flex flex-wrap gap-1"><Chip label="Needs: Sales Orders" dim /></div></div>
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold mb-1">On payment, updates</p>
            <div className="flex flex-wrap gap-1"><Chip label="Customer Outstanding Balance" /></div>
          </PipeStep>
          <PipeStep n={8} icon={FiTruck} title="Purchase Orders" sub="Created when restocking inventory from a supplier.">
            <div className="mb-2"><div className="flex flex-wrap gap-1"><Chip label="Needs: Suppliers" dim /></div></div>
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold mb-1">On receipt, updates</p>
            <div className="flex flex-wrap gap-1"><Chip label="Increases Inventory Stock" /></div>
          </PipeStep>
        </div>

        {/* Module Reference Cards */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">All Module Dependencies</p>
          <div className="grid md:grid-cols-2 gap-3">
            <ModuleCard icon={FiUsers} name="Customers"
              creates={['Estimations (linked)', 'Quotations (linked)', 'Outstanding Balance']} />
            <ModuleCard icon={FiCpu} name="Machines"
              note="Defines rates for Finishings and links to Plate inventory."
              creates={['Finishings (rate source)', 'Plates (linked)']} />
            <ModuleCard icon={FiTool} name="Finishings"
              needs={['Machines']}
              creates={['Used in Estimations']} />
            <ModuleCard icon={FiPrinter} name="Estimation"
              needs={['Customers', 'Machines', 'Finishings', 'SFG Items', 'Statics', 'Services', 'RM']}
              creates={['Used in Quotations']} />
            <ModuleCard icon={FiFileText} name="Quotation"
              needs={['Customers', 'Estimations']}
              creates={['Sales Order (on convert)']} />
            <ModuleCard icon={FiShoppingCart} name="Sales Order"
              needs={['Quotation', 'Inventory (stock)']}
              creates={['Task List', 'BOM', 'Routing', 'Timeline']} />
            <ModuleCard icon={FiList} name="BOM"
              note="Triggered automatically on Sales Order creation."
              needs={['Inventory stock']}
              creates={['Deducts Paper', 'Deducts Plates', 'Deducts SFG / RM']} />
            <ModuleCard icon={FiCalendar} name="Planning"
              needs={['Task List (from SO)', 'Machines']} />
            <ModuleCard icon={FiDollarSign} name="Invoices"
              needs={['Sales Orders']}
              creates={['Updates Customer Outstanding']} />
            <ModuleCard icon={FiDatabase} name="Suppliers"
              creates={['Linked to Purchase Orders']} />
            <ModuleCard icon={FiTruck} name="Purchase Orders"
              needs={['Suppliers']}
              creates={['Increases Inventory Stock']} />
            <ModuleCard icon={FiPackage} name="Inventory"
              note="Increases from Purchase Orders. Decreases from BOM on SO conversion."
              needs={['Purchase Orders (increase)']}
              creates={['Consumed by BOM', 'Checked on SO conversion']} />
          </div>
        </div>

      </div>
    );
  })(),



  sales: (
    <div className="space-y-8">
      <SectionTitle icon={FiTrendingUp}>The Sales Workflow</SectionTitle>
      <div className="relative">
        <div className="absolute left-5 top-8 bottom-8 w-px bg-gradient-to-b from-indigo-500/50 via-purple-500/50 to-emerald-500/50" />
        <div className="space-y-4">
          {[
            { Icon: FiUser,         color: '#6366f1', title: 'Add Customer',          desc: 'Create the customer record under Customers. Include contact details, address and credit terms.' },
            { Icon: FiPrinter,      color: '#8b5cf6', title: 'Build Estimation',       desc: 'Go to Estimations → New. Add components (Cover, Inner, Finishing, SFG). Fill in machine, paper, sizes and colours. Click Calculate to see the breakdown.' },
            { Icon: FiFileText,     color: '#0ea5e9', title: 'Create Quotation',       desc: 'Go to Quotations → New. Select customer, link to your estimation. Add optional notes or terms. Send or download as PDF.' },
            { Icon: FiCheckSquare,  color: '#10b981', title: 'Convert to Sales Order', desc: 'Once customer approves, click Convert to Sales Order on the quotation. Stock is automatically deducted at this point.' },
            { Icon: FiDollarSign,   color: '#f59e0b', title: 'Generate Invoice',       desc: 'From the Sales Order, generate an invoice. Track as Unpaid → Partial → Paid.' },
          ].map((step, i) => (
            <div key={i} className="flex gap-4 pl-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 mt-1" style={{ background: `${step.color}30`, border: `1px solid ${step.color}50` }}>
                <step.Icon className="w-3.5 h-3.5" style={{ color: step.color }} />
              </div>
              <div className="rounded-xl bg-black/40 border border-white/[0.07] p-4 flex-1">
                <p className="font-semibold text-white text-sm mb-1">{step.title}</p>
                <p className="text-sm text-white/55">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionTitle icon={FiFileText}>Quotations</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Card icon={FiClipboard} title="Linking Estimations" accent="#0ea5e9">
          <p>A quotation can pull pricing directly from an existing estimation. Navigate to Quotations → New, select a customer, then choose an estimation from the dropdown.</p>
        </Card>
        <Card icon={FiFileText} title="PDF Export" accent="#6366f1">
          <p>Every quotation can be exported as a professional PDF. Click the Export PDF button on the quotation detail page. The PDF includes itemised costs and company branding.</p>
        </Card>
      </div>
      <Warning>Do NOT delete an estimation that is already linked to a quotation. This will break the quotation's cost data.</Warning>
    </div>
  ),

  estimations: (
    <div className="space-y-8">
      <SectionTitle icon={FiPrinter}>Creating Estimations</SectionTitle>
      <div className="space-y-3">
        <Step n="1">Go to <strong className="text-white">Estimations → New Estimation</strong> (or Items → New Item for reusable templates).</Step>
        <Step n="2">Enter the job name, customer, and quantity.</Step>
        <Step n="3">Add components using <strong className="text-white">+ Add Tab</strong>. Each tab is one print component.</Step>
        <Step n="4">For each component, select Type (Offset/Digital), Machine, Paper, sizes, colours and finishings.</Step>
        <Step n="5">Click <strong className="text-white">Calculate Estimation</strong> to see the live cost breakdown in the sidebar.</Step>
        <Step n="6">Adjust markup % if needed, then Save.</Step>
      </div>

      <SectionTitle icon={FiFlag}>Component Naming</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { name: '"Cover"', accent: '#6366f1', desc: 'Shows cover-specific fields. Pages are locked to match Sides.' },
          { name: '"Inner" / "Inners"', accent: '#0ea5e9', desc: 'Shows inner page fields with full pages × sides calculation.' },
          { name: '"Finishing"', accent: '#10b981', desc: 'Shows material/finishing-specific inputs. No machine selection required.' },
          { name: '"SFG" / "Assets"', accent: '#f59e0b', desc: 'Shows the SFG Inventory panel. Lets you attach semi-finished goods from stock.' },
        ].map(c => (
          <Card key={c.name} icon={FiFlag} title={c.name} accent={c.accent}><p>{c.desc}</p></Card>
        ))}
      </div>

      <SectionTitle icon={FiActivity}>Wastage &amp; Sheets</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Card icon={FiFileText} title="Covers — Use Wastage Cutsheets" accent="#ec4899">
          <p>Covers print individually (not in sets). Set the Wastage field using <Badge color="purple">Wastage Cutsheets</Badge> mode.</p>
        </Card>
        <Card icon={FiLayers} title="Inners / Inserts — Use Sets" accent="#0ea5e9">
          <p>Inner pages print in sets. Use <Badge color="blue">Sets / Wastage Sheets</Badge> mode so the system calculates correctly per set.</p>
        </Card>
        <Card icon={FiMaximize2} title="Non-Standard Cut Sizes" accent="#f59e0b">
          <p>If your cut sheet is a non-standard size (e.g. 12×18 on SM74 for A5), enter the number of cut sheets per full A1 sheet in the <Badge color="amber">Cut Sheets / Full Sheet</Badge> field.</p>
        </Card>
        <Card icon={FiRefreshCw} title="Back &amp; Back Printing" accent="#ef4444">
          <p><Badge color="red">Enable B&amp;B</Badge> ONLY for single-colour back-and-back jobs. Do NOT use for multi-colour perfecting — the calculation will be wrong.</p>
        </Card>
      </div>

      <SectionTitle icon={FiPackage}>SFG / Assets in Components</SectionTitle>
      <Info>When a component is named "SFG" or "Assets", an inventory stock panel appears below the finishings section. You can add semi-finished goods from inventory, set quantities and unit prices. These costs are included in the grand total and stock is auto-deducted when the job is converted to a Sales Order.</Info>

      <SectionTitle icon={FiLayout}>Multiple Units Per Product</SectionTitle>
      <Card icon={FiLayout} title="e.g. Hard Cover — 2 Chip Boards per book" accent="#6366f1">
        <p>If one finished product requires 2 of a component (e.g. two end pages or two chip boards):</p>
        <div className="space-y-1 mt-2">
          <p><Badge color="red">Avoid</Badge> Just doubling the quantity — causes issues when copying.</p>
          <p><Badge color="green">Correct</Badge> Set Sides to Both → double the page count → set Sides back to One Side.</p>
        </div>
      </Card>

      <SectionTitle icon={FiTool}>Material-Only Components</SectionTitle>
      <Card icon={FiTool} title="No Machine Components (e.g. End Pages, Chip Boards)" accent="#10b981">
        <p>Set Machine to <Badge color="green">Select Machine</Badge> and set both Plate Cost/unit and Impression Cost to <code className="text-emerald-300">0</code>. The system will calculate only the paper/material cost.</p>
      </Card>
    </div>
  ),

  inventory: (
    <div className="space-y-8">
      <SectionTitle icon={FiPackage}>Inventory Categories</SectionTitle>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: FiFileText,  cat: 'Paper', accent: '#0ea5e9', desc: 'Print substrates. Requires width & height (cm), type (OFFSET/DIGITAL/BOTH). Used in estimation paper cost calculations.' },
          { icon: FiLayers,    cat: 'Plate', accent: '#6366f1', desc: 'Printing plates. Tracked separately. Used in plate cost calculations per component.' },
          { icon: FiActivity,  cat: 'Ink',   accent: '#ec4899', desc: 'Inks and consumables. Tracked for BOM deduction during SFG production.' },
          { icon: FiBox,       cat: 'SFG',   accent: '#f59e0b', desc: 'Semi-Finished Goods. Can be attached to estimation components. Stock deducted on Sales Order creation.' },
          { icon: FiPackage,   cat: 'RM',    accent: '#10b981', desc: 'Raw Materials. General input materials not yet processed.' },
          { icon: FiCheck,     cat: 'FG',    accent: '#84cc16', desc: 'Finished Goods. Final products ready for sale. Supports BOM linking.' },
        ].map(c => (
          <Card key={c.cat} icon={c.icon} title={c.cat} accent={c.accent}><p>{c.desc}</p></Card>
        ))}
      </div>

      <SectionTitle icon={FiRefreshCw}>Restocking</SectionTitle>
      <div className="space-y-3">
        <Step n="1">Click <strong className="text-white">Restock</strong> on any inventory row.</Step>
        <Step n="2">Enter the quantity to add and an optional reference note (e.g. PO #123).</Step>
        <Step n="3">For SFG / FG items, the BOM deduction preview shows which components will be consumed and flags any insufficient stock in red.</Step>
        <Step n="4">Click <strong className="text-white">Save</strong> — stock is updated and the transaction is logged in History.</Step>
      </div>
      <Info>Every stock movement (restock, deduction, sales order) is logged. Click the clock history icon on any item to view full transaction history.</Info>

      <SectionTitle icon={FiList}>Bill of Materials (BOM)</SectionTitle>
      <Card icon={FiList} title="SFG &amp; FG BOM" accent="#f59e0b">
        <p>SFG and FG items can have a Bill of Materials — a list of RM/Ink/Paper components consumed to produce one unit. When restocking an SFG/FG item, the system automatically deducts the BOM quantities from component stocks.</p>
        <p className="mt-2">Edit the BOM from Inventory → select SFG/FG category → Edit item → scroll to BOM Editor.</p>
      </Card>

      <SectionTitle icon={FiAlertTriangle}>Low Stock Alerts</SectionTitle>
      <Card icon={FiAlertTriangle} title="Min Stock Threshold" accent="#ef4444">
        <p>Set a <Badge color="red">Min Stock</Badge> value for each item. When current stock falls below this threshold, the item is highlighted in red on the inventory table and a low stock count appears in the page header.</p>
      </Card>

      <SectionTitle icon={FiUpload}>Bulk Upload</SectionTitle>
      <Card icon={FiUpload} title="CSV / Excel Import" accent="#6366f1">
        <p>Use the <strong className="text-white">Bulk Upload</strong> button to import multiple inventory items at once from a CSV or Excel file. Download the template first to ensure correct column formatting.</p>
      </Card>
    </div>
  ),

  production: (
    <div className="space-y-8">
      <SectionTitle icon={FiCalendar}>Job Planning</SectionTitle>
      <div className="space-y-3">
        <Step n="1">A Sales Order is created from an approved quotation.</Step>
        <Step n="2">Go to <strong className="text-white">Planning</strong> to see all active production jobs queued per machine.</Step>
        <Step n="3">Operators scan the QR code on a Job Ticket to access their specific task on mobile.</Step>
        <Step n="4">Each task has a status: <Badge color="blue">Pending</Badge> → <Badge color="amber">In Progress</Badge> → <Badge color="green">Completed</Badge>.</Step>
        <Step n="5">Completion timestamps are recorded and cannot be reversed (to maintain audit integrity).</Step>
      </div>

      <SectionTitle icon={FiPrinter}>Job Tickets</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Card icon={FiClipboard} title="Printable Job Ticket" accent="#6366f1">
          <p>Each Sales Order generates a Job Ticket PDF with full specifications — paper, machine, colours, imposition layout and QR code for operator scanning.</p>
        </Card>
        <Card icon={FiSmartphone} title="Mobile Operator View" accent="#10b981">
          <p>Operators use the QR code to access a mobile-optimised task page. They can mark tasks in progress or completed directly from their phone without needing login access to the full ERP.</p>
        </Card>
      </div>

      <SectionTitle icon={FiActivity}>Machine Metrics</SectionTitle>
      <Card icon={FiTrendingUp} title="Production Time Estimates" accent="#f59e0b">
        <p>The planning board shows estimated production times per machine based on:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-white/55 text-sm">
          <li>Sheet count × machine speed (Sheets/Hr) for printing</li>
          <li>Impression count for multi-side jobs (accounts for Sides value)</li>
          <li>Direct throughput for finishing machines</li>
        </ul>
      </Card>

      <SectionTitle icon={FiTarget}>Competitor Analysis</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Card icon={FiTarget} title="Price Comparison" accent="#84cc16">
          <p>Add competitor price data against your own estimations. The system calculates your margin advantage or disadvantage per item.</p>
        </Card>
        <Card icon={FiFileText} title="Export Report" accent="#6366f1">
          <p>Generate a detailed PDF report showing your unit price vs competitors, full estimation cost snapshot including components and finishings.</p>
        </Card>
      </div>
    </div>
  ),

  tips: (
    <div className="space-y-6">
      <SectionTitle icon={FiZap}>Pro Tips &amp; Best Practices</SectionTitle>

      <div className="grid md:grid-cols-2 gap-4">
        <Card icon={FiClipboard} title="Use Items as Templates" accent="#6366f1">
          <p>Save frequently-used job configurations under <strong className="text-white">Items</strong> (not Estimations). Items are reusable templates you can pull into any quotation without re-entering all the specs every time.</p>
        </Card>
        <Card icon={FiCopy} title="Copy Components" accent="#0ea5e9">
          <p>Use the <strong className="text-white">Copy</strong> button on any component tab to duplicate it. Useful when a job has two similar components (e.g. Cover Front and Cover Back with minor differences).</p>
        </Card>
        <Card icon={FiPercent} title="Markup vs Unit Price" accent="#f59e0b">
          <p>Use the <strong className="text-white">Markup %</strong> field in the sidebar for a blanket margin on top of all costs. The grand total shown already includes SFG items, global finishings, and the markup amount.</p>
        </Card>
        <Card icon={FiMonitor} title="Digital vs Offset" accent="#ec4899">
          <p>Toggle the <strong className="text-white">Offset / Digital</strong> switch per component. Digital uses price per sq cm and doesn't need plates. Offset uses impression cost and plate cost per unit.</p>
        </Card>
        <Card icon={FiMaximize2} title="Imposition Visualizer" accent="#8b5cf6">
          <p>After filling in paper and component dimensions, the <strong className="text-white">Imposition Visualizer</strong> shows how the job fits on the sheet. If the visual looks wrong, check Cut Sheet dimensions vs Component dimensions.</p>
        </Card>
        <Card icon={FiGlobe} title="Global Finishings" accent="#10b981">
          <p><strong className="text-white">Global Finishings</strong> in the sidebar apply to the entire job (not per component). Use these for job-wide costs like lamination, shrink wrap or delivery that aren't tied to a specific print component.</p>
        </Card>
      </div>

      <SectionTitle icon={FiAlertTriangle}>Common Mistakes to Avoid</SectionTitle>
      <div className="space-y-3">
        <Warning>Do NOT delete estimations that are linked to quotations. The quotation will lose all its cost data.</Warning>
        <Warning>Do NOT enable Back & Back for multi-colour perfecting jobs — use it only for single-colour B&B. The impression calculation will be wrong otherwise.</Warning>
        <Warning>When adding SFG items to a component, make sure the inventory items have category "SF" or "SFG" — otherwise they won't appear in the search dropdown.</Warning>
        <Warning>Stock deduction happens automatically when a quotation is converted to a Sales Order. Ensure inventory is up to date before converting.</Warning>
      </div>

      <SectionTitle>⌨️ Quick Reference</SectionTitle>
      <div className="rounded-2xl border border-white/[0.07] bg-black/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-white/35 font-semibold">Action</th>
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-white/35 font-semibold">Where to find it</th>
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-white/35 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {[
              ['New estimation', 'Estimations → New', 'One-off jobs with customer'],
              ['New item template', 'Items → New', 'Reusable job specs'],
              ['Add SFG to a component', 'Name component "SFG" or "Assets"', 'Inventory panel appears below finishings'],
              ['Restock inventory', 'Inventory → Restock button', 'Logs transaction history'],
              ['Convert quote to order', 'Quotation detail → Convert', 'Auto deducts stock'],
              ['Export job ticket PDF', 'Sales Order detail → Export PDF', 'A4 specs + A3 imposition'],
              ['View stock history', 'Inventory → 🕐 icon on row', 'Full transaction log'],
              ['Add competitor prices', 'Competitor Analysis → New', 'Compare vs our estimation'],
            ].map(([action, where, note], i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-white/80 font-medium">{action}</td>
                <td className="px-4 py-2.5 text-white/45 font-mono text-xs">{where}</td>
                <td className="px-4 py-2.5 text-white/40">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
};

export default function GuidePage() {
  const [active, setActive] = useState('overview');

  return (
    <div className="text-white min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter">User Guide</h1>
        <p className="text-white/40 text-sm mt-1">Everything you need to know about using Pressmatics ERP</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap mb-8 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              active === t.id
                ? 'bg-white text-black shadow-lg'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <t.Icon className="w-3.5 h-3.5 shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>{CONTENT[active]}</div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-white/[0.05] text-center text-xs text-white/20">
        Pressmatics ERP · Internal Use Only · Contact your system admin for access issues
      </div>
    </div>
  );
}
