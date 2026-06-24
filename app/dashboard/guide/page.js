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
    FiPlay, FiSmartphone, FiActivity, FiSearch
} from 'react-icons/fi';

const TABS = [
  { id: 'overview',    label: 'Overview',    Icon: FiMap },
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
