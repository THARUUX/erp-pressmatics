'use client';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiUsers, FiUserPlus, FiGrid, FiList, FiChevronUp, FiChevronDown, FiUpload, FiPenTool, FiDownload } from 'react-icons/fi';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { BulkEditModal } from '@/components/ui/BulkEditModal';
import { numericOperatorFilterFn } from '@/lib/numericFilter';

const SHIFTS = ['Day', 'Night', 'Flexible'];
const STATUSES = ['active', 'on_leave', 'inactive'];
const DEPT_OPTIONS = ['Prepress', 'Offset Press', 'Digital Press', 'Finishing', 'Packaging', 'Admin'];
const TEAM_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#14b8a6'];

const EMPTY_EMP = { name:'', job_title:'', department:'', phone:'', email:'', date_of_birth:'', date_joined:'', shift:'Day', status:'active', notes:'', pay_type:'monthly', base_salary:0, hourly_rate:0, allowances:0, deductions:0, ot_rate_multiplier:1.5, standard_working_hours:8 };
const EMPTY_TEAM = { name:'', description:'', color:'#6366f1', member_ids:[] };

const statusColor = s => s==='active'?'text-emerald-400 bg-emerald-500/10 border-emerald-500/20':s==='on_leave'?'text-amber-400 bg-amber-500/10 border-amber-500/20':'text-gray-400 bg-gray-500/10 border-gray-500/20';
function ColumnFilter({ column }) {
  const val = column.getFilterValue() ?? '';
  return (
    <input
      value={val}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder="Filter…"
      onClick={e => e.stopPropagation()}
      className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30"
    />
  );
}

export default function EmployeesPage() {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [viewMode, setViewMode] = useState('card');
  const [sorting, setSorting] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const visibleCols = table.getVisibleLeafColumns()
        .filter(col => col.id !== 'select' && col.id !== 'actions')
        .map(col => ({
          key: col.id || col.columnDef.accessorKey,
          header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
        }));

      const filteredRows = table.getFilteredRowModel().rows.map(row => {
        const emp = row.original;
        return {
          ...emp,
          salary: emp.pay_type === 'monthly' ? `${emp.base_salary} /mo` : `${emp.hourly_rate} /hr`
        };
      });

      const res = await fetch('/api/pdf/dynamic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Employees Directory Report',
          subtitle: 'Exported Employees List (Customized & Filtered)',
          columns: visibleCols,
          rows: filteredRows,
          currency: 'LKR'
        })
      });

      if (!res.ok) {
        toast.error('Failed to generate PDF');
        setExportingPdf(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Export PDF error:', error);
      toast.error('An error occurred while generating PDF');
    } finally {
      setExportingPdf(false);
    }
  };
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [rowSelection, setRowSelection] = useState({});
  const [deleteProgress, setDeleteProgress] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP);
  const [saving, setSaving] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM);
  const [memberSearch, setMemberSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [eRes, tRes] = await Promise.all([fetch('/api/employees'), fetch('/api/teams')]);
      const [eData, tData] = await Promise.all([eRes.json(), tRes.json()]);
      setEmployees(Array.isArray(eData) ? eData : []);
      setTeams(Array.isArray(tData) ? tData : []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const savedView = localStorage.getItem('employee_view_mode');
    if (savedView === 'card' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  const openAddEmp = () => { setEditEmp(null); setEmpForm(EMPTY_EMP); setShowModal(true); };
  const openEditEmp = (e) => { setEditEmp(e); setEmpForm({ name:e.name, job_title:e.job_title||'', department:e.department||'', phone:e.phone||'', email:e.email||'', date_of_birth:e.date_of_birth?e.date_of_birth.slice(0,10):'', date_joined:e.date_joined?e.date_joined.slice(0,10):'', shift:e.shift||'Day', status:e.status||'active', notes:e.notes||'', pay_type:e.pay_type||'monthly', base_salary:e.base_salary||0, hourly_rate:e.hourly_rate||0, allowances:e.allowances||0, deductions:e.deductions||0, ot_rate_multiplier:e.ot_rate_multiplier||1.5, standard_working_hours:e.standard_working_hours||8 }); setShowModal(true); };

  const saveEmp = async (ev) => {
    ev.preventDefault(); setSaving(true);
    try {
      const url = editEmp ? `/api/employees/${editEmp.id}` : '/api/employees';
      const payload = {
        ...empForm,
        base_salary: parseFloat(empForm.base_salary) || 0,
        hourly_rate: parseFloat(empForm.hourly_rate) || 0,
        allowances: parseFloat(empForm.allowances) || 0,
        deductions: parseFloat(empForm.deductions) || 0,
        ot_rate_multiplier: parseFloat(empForm.ot_rate_multiplier) || 1.5,
        standard_working_hours: parseFloat(empForm.standard_working_hours) || 8,
      };
      const res = await fetch(url, { method: editEmp?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const d = await res.json();
      if (res.ok) { toast.success(editEmp?'Updated!':'Created!'); setShowModal(false); load(); }
      else toast.error(d.error||'Failed');
    } catch { toast.error('Error'); } finally { setSaving(false); }
  };

  const deleteEmp = async (e) => {
    if (!await confirmDialog(`Delete ${e.name}?`)) return;
    try {
      const res = await fetch(`/api/employees/${e.id}`, { method:'DELETE' });
      if (res.ok) { toast.success('Deleted'); load(); }
      else { const d=await res.json(); toast.error(d.error||'Failed'); }
    } catch { toast.error('Error'); }
  };

  const openAddTeam = () => { setEditTeam(null); setTeamForm(EMPTY_TEAM); setMemberSearch(''); setShowTeamModal(true); };
  const openEditTeam = (t) => { setEditTeam(t); setTeamForm({ name:t.name, description:t.description||'', color:t.color||'#6366f1', member_ids:(t.members||[]).map(m=>m.id) }); setMemberSearch(''); setShowTeamModal(true); };

  const saveTeam = async (ev) => {
    ev.preventDefault(); setSaving(true);
    try {
      const url = editTeam ? `/api/teams/${editTeam.id}` : '/api/teams';
      const res = await fetch(url, { method: editTeam?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(teamForm) });
      const d = await res.json();
      if (res.ok) { toast.success(editTeam?'Updated!':'Created!'); setShowTeamModal(false); load(); }
      else toast.error(d.error||'Failed');
    } catch { toast.error('Error'); } finally { setSaving(false); }
  };

  const deleteTeam = async (t) => {
    if (!await confirmDialog(`Delete team "${t.name}"?`)) return;
    try {
      const res = await fetch(`/api/teams/${t.id}`, { method:'DELETE' });
      if (res.ok) { toast.success('Deleted'); load(); }
      else { const d=await res.json(); toast.error(d.error||'Failed'); }
    } catch { toast.error('Error'); }
  };

  const toggleMember = (id) => setTeamForm(prev => ({ ...prev, member_ids: prev.member_ids.includes(id) ? prev.member_ids.filter(x=>x!==id) : [...prev.member_ids, id] }));

  const filteredEmps = useMemo(() => {
    return employees.filter(e =>
      (!search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.email||'').toLowerCase().includes(search.toLowerCase()) || (e.job_title||'').toLowerCase().includes(search.toLowerCase())) &&
      (!filterStatus || e.status === filterStatus) &&
      (!filterDept || e.department === filterDept)
    );
  }, [employees, search, filterStatus, filterDept]);

  const fmtCurrency = (n = 0) => {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(n);
  };

  const columns = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected();
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={e => e.stopPropagation()}
          className="rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
        />
      ),
      size: 40,
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Employee',
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="flex items-center gap-3 py-1">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarColor(emp.name)} to-black/50 flex items-center justify-center text-white font-bold text-sm shadow-md`}>
              {emp.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-white text-sm">{emp.name}</div>
              <div className="text-[10px] text-gray-500 font-mono">{emp.employee_id}</div>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'job_title',
      header: 'Role / Department',
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="py-1">
            <div className="text-white text-sm">{emp.job_title || '—'}</div>
            <div className="text-xs text-gray-400 mt-0.5">{emp.department || '—'}</div>
          </div>
        );
      }
    },
    {
      accessorKey: 'contact',
      header: 'Contact Info',
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="text-xs py-1">
            <div className="text-gray-300">{emp.email || '—'}</div>
            <div className="text-gray-500 mt-0.5">{emp.phone || '—'}</div>
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(emp.status)}`}>
            {emp.status?.replace('_', ' ')}
          </span>
        );
      }
    },
    {
      accessorKey: 'shift',
      header: 'Shift',
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <span className="text-xs text-gray-300 bg-white/[0.04] border border-white/[0.05] px-2.5 py-1 rounded-lg">
            {emp.shift || '—'}
          </span>
        );
      }
    },
    {
      id: 'salary',
      accessorFn: row => row.base_salary || row.hourly_rate || 0,
      header: 'Compensation',
      filterFn: numericOperatorFilterFn,
      cell: ({ row }) => {
        const emp = row.original;
        const formattedPay = emp.pay_type === 'monthly'
          ? `${fmtCurrency(emp.base_salary)}/mo`
          : `${fmtCurrency(emp.hourly_rate)}/hr`;
        return (
          <div className="text-xs py-1">
            <div className="font-semibold text-white">{formattedPay}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Allowances: {fmtCurrency(emp.allowances)}</div>
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="flex justify-end gap-1">
            <button onClick={() => openEditEmp(emp)} className="p-2 text-gray-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] rounded-lg transition-colors cursor-pointer" title="Edit">
              <FiEdit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteEmp(emp)} className="p-2 text-gray-400 hover:text-red-400 bg-white/[0.02] hover:bg-red-500/10 border border-red-500/15 rounded-lg transition-colors cursor-pointer" title="Delete">
              <FiTrash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }
    }
  ], [employees]);

  const table = useReactTable({
    data: filteredEmps,
    columns,
    state: { sorting, columnVisibility, rowSelection, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  });

  const selectedIds = useMemo(() => {
    return table.getSelectedRowModel().flatRows.map(row => row.original.id);
  }, [rowSelection, filteredEmps, table]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!(await confirmDialog(`Delete ${selectedIds.length} selected employee(s)?`, { danger: true, confirmLabel: 'Delete' }))) return;

    const total = selectedIds.length;
    let deleted = 0;
    const failed = [];

    const nameMap = {};
    table.getSelectedRowModel().flatRows.forEach(row => {
      nameMap[row.original.id] = row.original.name;
    });

    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      setDeleteProgress({ current: i + 1, total, currentName: nameMap[id] || `Employee #${id}` });
      try {
        const res = await fetch(`/api/employees/bulk`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id] })
        });
        if (res.ok) { deleted++; }
        else { failed.push(nameMap[id] || id); }
      } catch { failed.push(nameMap[id] || id); }
    }

    setDeleteProgress(null);
    setRowSelection({});
    load();

    if (failed.length > 0) {
      toast.error(`Deleted ${deleted} employee(s). ${failed.length} could not be deleted.`);
    } else {
      toast.success(`${deleted} employee(s) deleted successfully`);
    }
  };

  const stats = { total: employees.length, active: employees.filter(e=>e.status==='active').length, on_leave: employees.filter(e=>e.status==='on_leave').length, inactive: employees.filter(e=>e.status==='inactive').length };

  const fld = (label, key, type='text', opts=null) => (
    <div key={key}>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      {opts ? (
        <select value={empForm[key]} onChange={e=>setEmpForm(p=>({...p,[key]:e.target.value}))} className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]">
          {opts.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={empForm[key]} onChange={e=>setEmpForm(p=>({...p,[key]:e.target.value}))} className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30" />
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white">Employees</h1>
          <p className="text-gray-400 text-sm mt-1">Manage press workers, teams and machine assignments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {tab==='employees' && selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-900/40 hover:border-red-500/50 hover:text-red-300 transition-all shadow-lg shadow-red-950/20 cursor-pointer"
            >
              <FiTrash2 className="w-4 h-4" /> Delete ({selectedIds.length})
            </button>
          )}
          {tab==='employees' && (
            <>
              <button
                onClick={handleExportPDF}
                disabled={exportingPdf}
                className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2 rounded-xl text-sm font-semibold hover:border-white/20 hover:text-white transition-colors cursor-pointer disabled:opacity-50">
                <FiDownload className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2 rounded-xl text-sm font-semibold hover:border-white/20 hover:text-white transition-colors cursor-pointer">
                <FiUpload className="w-4 h-4" /> Import CSV
              </button>
              <button
                onClick={() => setShowBulkEdit(true)}
                className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2 rounded-xl text-sm font-semibold hover:border-white/20 hover:text-white transition-colors cursor-pointer">
                <FiPenTool className="w-4 h-4" /> Bulk Edit
              </button>
            </>
          )}
          <div className="flex gap-1 bg-black/30 border border-white/10 p-1 rounded-xl">
            {['employees','teams'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab===t?'bg-white text-black':'text-gray-400 hover:text-white'}`}>{t}</button>
            ))}
          </div>
          <button onClick={tab==='employees'?openAddEmp:openAddTeam} className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer">
            <FiPlus className="w-4 h-4" />{tab==='employees'?'Add Employee':'New Team'}
          </button>
        </div>
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {tab==='employees' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Total',stats.total,'text-white'],['Active',stats.active,'text-emerald-400'],['On Leave',stats.on_leave,'text-amber-400'],['Inactive',stats.inactive,'text-gray-500']].map(([l,v,c])=>(
              <div key={l} className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">{l}</p>
                <p className={`text-3xl font-bold tracking-tight ${c}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..." className="w-full pl-9 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-white/30"/></div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"><option value="">All Status</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
            <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} className="px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"><option value="">All Depts</option>{DEPT_OPTIONS.map(d=><option key={d} value={d}>{d}</option>)}</select>
            {viewMode === 'list' && <ColumnToggle table={table} />}
            <div className="flex bg-black/30 border border-white/10 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  setViewMode('card');
                  localStorage.setItem('employee_view_mode', 'card');
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'card' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                title="Card View"
              >
                <FiGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  localStorage.setItem('employee_view_mode', 'list');
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                title="List View"
              >
                <FiList className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Views */}
          {loading ? (
            <div className="text-center py-16 text-gray-500">Loading...</div>
          ) : filteredEmps.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-black/20 border border-white/5 rounded-2xl">
              <FiUserPlus className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">No employees found</p>
              <p className="text-xs mt-1">Add your first employee to get started.</p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEmps.map(emp=>(
                <div key={emp.id} className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor(emp.name)} to-black/50 flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>openEditEmp(emp)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"><FiEdit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>deleteEmp(emp)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"><FiTrash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                  <p className="font-semibold text-white text-sm leading-tight">{emp.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{emp.job_title||'—'}</p>
                  {emp.department && <p className="text-gray-600 text-xs mt-0.5">{emp.department}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(emp.status)}`}>{emp.status?.replace('_',' ')}</span>
                    {emp.shift && <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{emp.shift}</span>}
                    {emp.team_count>0 && <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">{emp.team_count} team{emp.team_count>1?'s':''}</span>}
                  </div>
                  <p className="text-gray-600 text-[10px] mt-2 font-mono">{emp.employee_id}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.02]">
                        {headerGroup.headers.map(header => (
                          <th
                            key={header.id}
                            className={`px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider select-none transition-colors ${header.column.columnDef.enableSorting !== false ? 'cursor-pointer hover:text-white' : ''}`}
                            onClick={header.column.columnDef.enableSorting !== false ? header.column.getToggleSortingHandler() : undefined}
                          >
                            <div className="flex items-center gap-1.5">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.columnDef.enableSorting !== false && ({
                                asc: <FiChevronUp className="w-3.5 h-3.5 text-white" />,
                                desc: <FiChevronDown className="w-3.5 h-3.5 text-white" />
                              }[header.column.getIsSorted()] ?? null)}
                            </div>
                            {header.column.getCanFilter() && <ColumnFilter column={header.column} />}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {table.getRowModel().rows.map(row => (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-6 py-3.5 text-sm text-gray-300 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TEAMS TAB ── */}
      {tab==='teams' && (
        <div className="space-y-4">
          {loading ? <div className="text-center py-16 text-gray-500">Loading...</div> : teams.length===0 ? (
            <div className="text-center py-16 text-gray-500 bg-black/20 border border-white/5 rounded-2xl">
              <FiUsers className="w-10 h-10 mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">No teams yet</p>
              <p className="text-xs mt-1">Create a team and assign employees to it.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map(team=>(
                <div key={team.id} className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{backgroundColor: team.color+'22', border:`1px solid ${team.color}44`}}>
                          <FiUsers className="w-4 h-4" style={{color: team.color}}/>
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{team.name}</p>
                          <p className="text-gray-500 text-xs">{team.member_count} member{team.member_count!==1?'s':''}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>openEditTeam(team)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"><FiEdit2 className="w-3.5 h-3.5"/></button>
                        <button onClick={()=>deleteTeam(team)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"><FiTrash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                    {team.description && <p className="text-gray-500 text-xs mb-3 leading-relaxed">{team.description}</p>}
                    {(team.members||[]).length>0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {team.members.map(m=>(
                          <span key={m.id} className="inline-flex items-center gap-1 text-[10px] bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded-full">
                            <span className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">{m.name.charAt(0)}</span>
                            {m.name}
                            {m.role==='lead' && <span className="text-amber-400 text-[8px]">★</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEE MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
              <h3 className="text-lg font-bold text-white">{editEmp?'Edit Employee':'Add Employee'}</h3>
              <button onClick={()=>setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX/></button>
            </div>
            <form onSubmit={saveEmp} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                {fld('Full Name *','name')}
                {fld('Job Title','job_title')}
                {fld('Department','department','text',DEPT_OPTIONS)}
                {fld('Phone','phone','tel')}
                {fld('Email','email','email')}
                {fld('Date of Birth','date_of_birth','date')}
                {fld('Date Joined','date_joined','date')}
                {fld('Shift','shift','text',SHIFTS)}
                {fld('Status','status','text',STATUSES)}
              </div>

              <div className="border-t border-white/[0.07] pt-4">
                <h4 className="text-sm font-bold text-white mb-4">Payroll & Salary Settings</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  {fld('Pay Type', 'pay_type', 'text', ['monthly', 'hourly'])}
                  {empForm.pay_type === 'monthly' ? fld('Base Salary (Monthly)', 'base_salary', 'number') : fld('Hourly Rate', 'hourly_rate', 'number')}
                  {fld('Monthly Allowances', 'allowances', 'number')}
                  {fld('Monthly Deductions', 'deductions', 'number')}
                  {fld('OT Rate Multiplier', 'ot_rate_multiplier', 'number')}
                  {fld('Standard Work Hours / Day', 'standard_working_hours', 'number')}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea value={empForm.notes} onChange={e=>setEmpForm(p=>({...p,notes:e.target.value}))} rows={3} className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 resize-none"/>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 cursor-pointer">
                  {saving&&<span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>}
                  {editEmp?'Save Changes':'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TEAM MODAL ── */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&setShowTeamModal(false)}>
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
              <h3 className="text-lg font-bold text-white">{editTeam?'Edit Team':'Create Team'}</h3>
              <button onClick={()=>setShowTeamModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX/></button>
            </div>
            <form onSubmit={saveTeam} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Team Name *</label>
                <input required value={teamForm.name} onChange={e=>setTeamForm(p=>({...p,name:e.target.value}))} className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={teamForm.description} onChange={e=>setTeamForm(p=>({...p,description:e.target.value}))} rows={2} className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 resize-none"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Team Color</label>
                <div className="flex gap-2 flex-wrap">
                  {TEAM_COLORS.map(c=>(
                    <button key={c} type="button" onClick={()=>setTeamForm(p=>({...p,color:c}))} className={`w-7 h-7 rounded-lg transition-all ${teamForm.color===c?'ring-2 ring-white ring-offset-1 ring-offset-black scale-110':''}`} style={{backgroundColor:c}}/>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Members ({teamForm.member_ids.length} selected)</label>
                <input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Search employees..." className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 mb-2"/>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {employees.filter(e=>!memberSearch||e.name.toLowerCase().includes(memberSearch.toLowerCase())).map(emp=>{
                    const sel = teamForm.member_ids.includes(emp.id);
                    return (
                      <div key={emp.id} onClick={()=>toggleMember(emp.id)} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-all ${sel?'bg-white/10 border-white/20':'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${avatarColor(emp.name)} to-black/50 flex items-center justify-center text-white font-bold text-xs`}>{emp.name.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                          <p className="text-xs text-gray-500">{emp.job_title||emp.department||'—'}</p>
                        </div>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${sel?'bg-white border-white':'border-white/20'}`}>
                          {sel&&<span className="text-black text-[10px] font-black">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                  {employees.filter(e=>!memberSearch||e.name.toLowerCase().includes(memberSearch.toLowerCase())).length===0&&<p className="text-center text-gray-600 text-sm py-4">No employees found</p>}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setShowTeamModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 cursor-pointer">
                  {saving&&<span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"/>}
                  {editTeam?'Save Changes':'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Bulk Delete Progress Modal ── */}
      {deleteProgress && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111]/95 border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full border-2 border-red-500/50 border-t-red-400 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Deleting employees…</p>
                <p className="text-xs text-white/40 mt-0.5 truncate max-w-[220px]">{deleteProgress.currentName}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/30">
              <span>{deleteProgress.current} of {deleteProgress.total}</span>
              <span>{Math.round((deleteProgress.current / deleteProgress.total) * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <BulkImportModal
          type="employees"
          onClose={() => setShowImport(false)}
          onComplete={() => { load(); toast.success('Employee list updated!'); }}
        />
      )}

      {showBulkEdit && (
        <BulkEditModal
          type="employees"
          data={employees}
          onClose={() => setShowBulkEdit(false)}
          onComplete={() => { load(); toast.success('Employees updated!'); }}
        />
      )}
    </div>
  );
}
