'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiPrinter, FiDownload, FiPlus, FiX, FiCheck, FiUser, FiFilter, FiSearch, FiActivity } from 'react-icons/fi';
import toast from 'react-hot-toast';
import AddTaskModal from './AddTaskModal';

const G = {
  bg:'#070710', glass:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.08)',
  text:'#f1f5f9', muted:'#94a3b8', subtle:'#475569', success:'#10b981', warning:'#f59e0b', danger:'#ef4444',
};
const STATUS_COLOR = { pending:'#64748b', in_progress:'#f59e0b', done:'#10b981' };

const fmtDate = (d) => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; };
const fmtTime = (m) => { if(!m) return '0m'; if(m>=60) return `${(m/60).toFixed(1)}h`; return `${m}m`; };
const getWeekStart = (d) => { const dt=new Date(d),day=dt.getDay(),diff=dt.getDate()-day+(day===0?-6:1); const s=new Date(dt.setDate(diff)); s.setHours(0,0,0,0); return s; };

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function ExportModal({ employee, weekStart, onClose }) {
  const [includeStats, setIncludeStats] = useState(true);
  const [excludeCompleted, setExcludeCompleted] = useState(false);
  const [format, setFormat] = useState('pdf');
  const [mode, setMode] = useState('weekly');
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const ws = fmtDate(weekStart);
      const params = new URLSearchParams({ weekStart:ws, format, includeStats:String(includeStats), excludeCompleted:String(excludeCompleted), columns:'code,customer,name,time,status' });
      const url = mode === 'unplanned'
        ? `/api/job-planning/employee/${employee.id}/unplanned-pdf?${new URLSearchParams({ format, includeStats:String(includeStats) })}`
        : `/api/job-planning/employee/${employee.id}/pdf?${params}`;
      const res = await fetch(url);
      if (!res.ok) { toast.error('Export failed'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `employee-${employee.name.replace(/\s+/g,'-')}-${mode}.${format === 'csv' ? 'csv' : 'pdf'}`;
      a.click();
    } catch { toast.error('Export error'); }
    setLoading(false);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#0a0a0a',border:`1px solid ${G.border}`,borderRadius:16,width:400,padding:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{color:G.text,fontSize:16,fontWeight:700,margin:0}}>Export — {employee.name}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:G.muted,cursor:'pointer'}}><FiX size={16}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[['weekly','Weekly Report'],['unplanned','Unplanned Queue']].map(([k,l])=>(
            <label key={k} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:mode===k?G.text:G.muted,fontSize:13}}>
              <input type="radio" checked={mode===k} onChange={()=>setMode(k)} style={{accentColor:'#a78bfa'}}/>
              {l}
            </label>
          ))}
          <hr style={{border:'none',borderTop:`1px solid ${G.border}`,margin:'4px 0'}}/>
          {[['pdf','PDF'],['csv','CSV']].map(([k,l])=>(
            <label key={k} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:format===k?G.text:G.muted,fontSize:13}}>
              <input type="radio" checked={format===k} onChange={()=>setFormat(k)} style={{accentColor:'#a78bfa'}}/>
              {l}
            </label>
          ))}
          <hr style={{border:'none',borderTop:`1px solid ${G.border}`,margin:'4px 0'}}/>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:G.muted,fontSize:13}}>
            <input type="checkbox" checked={includeStats} onChange={e=>setIncludeStats(e.target.checked)} style={{accentColor:'#10b981'}}/>
            Include Stats Summary
          </label>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:G.muted,fontSize:13}}>
            <input type="checkbox" checked={excludeCompleted} onChange={e=>setExcludeCompleted(e.target.checked)} style={{accentColor:'#10b981'}}/>
            Exclude Completed Tasks
          </label>
        </div>
        <button onClick={download} disabled={loading} style={{marginTop:20,width:'100%',padding:'10px 0',background:'white',color:'black',border:'none',borderRadius:10,fontWeight:700,fontSize:14,cursor:'pointer',opacity:loading?0.6:1}}>
          {loading ? 'Generating…' : `Download ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}

function TaskCard({ task, order, onSchedule, onUpdateStatus, isDragging, onDragStart }) {
  const dot = STATUS_COLOR[task.status] || STATUS_COLOR.pending;
  const name = (() => { const p=task.name.split('—'); return p[p.length-1]?.trim() || task.name; })();
  const jobLabel = task.estimation_names || task.customer_name || 'Standalone';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{background:'rgba(255,255,255,0.04)',border:`1px solid rgba(255,255,255,0.08)`,borderRadius:8,padding:'8px 10px',cursor:'grab',opacity:isDragging?0.4:1,marginBottom:6,transition:'opacity 0.2s'}}
    >
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <div style={{width:7,height:7,borderRadius:'50%',backgroundColor:dot,flexShrink:0}}/>
        <span style={{fontSize:10,color:'#f59e0b',fontWeight:700,background:'rgba(245,158,11,0.1)',padding:'1px 5px',borderRadius:4}}>{task.order_code||'GEN'}</span>
        <span style={{fontSize:10,color:G.muted,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{jobLabel}</span>
      </div>
      <div style={{fontSize:11,color:G.text,fontWeight:600,marginBottom:4,lineHeight:1.3}}>{name}</div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:10,color:G.subtle}}>{fmtTime(task.estimated_minutes)}</span>
        <div style={{display:'flex',gap:4}}>
          {(['pending','in_progress','done']).map(s=>(
            <button key={s} onClick={()=>onUpdateStatus(task.id,s)} title={s} style={{width:16,height:16,borderRadius:'50%',border:`1.5px solid ${STATUS_COLOR[s]}`,background:task.status===s?STATUS_COLOR[s]:'transparent',cursor:'pointer',padding:0}}/>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EmployeePlanning({ orders=[] }) {
  const [employees, setEmployees] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskDefaults, setAddTaskDefaults] = useState({});
  const [exportEmployee, setExportEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/job-planning/employee');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setEmployees(json.employees || []);
      setAllTasks(json.tasks || []);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); return { date:d, key:fmtDate(d), label:DAYS[i], short:d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) }; });
  const prevWeek = () => { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); };
  const nextWeek = () => { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); };
  const weekRangeStr = `${weekDays[0].short} – ${weekDays[6].short}, ${weekStart.getFullYear()}`;

  const getTasksForEmployeeDay = (empName, dateKey) => allTasks.filter(t => t.assigned_to===empName && t.scheduled_date && fmtDate(new Date(t.scheduled_date))===dateKey);
  const getUnplannedForEmployee = (empName) => allTasks.filter(t => t.assigned_to===empName && !t.scheduled_date);

  const handleDrop = async (empName, dateKey) => {
    if (!draggedTaskId) return;
    setDraggedTaskId(null); setDragOverCell(null);
    try {
      const res = await fetch('/api/job-planning/employee/assign', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ taskId: draggedTaskId, employeeName: empName, scheduledDate: dateKey }) });
      if (res.ok) { toast.success('Task scheduled'); load(); }
      else { const j=await res.json(); toast.error(j.error||'Failed'); }
    } catch { toast.error('Network error'); }
  };

  const handleUpdateStatus = async (taskId, status) => {
    try {
      await fetch('/api/job-planning/employee/assign', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ taskId, status }) });
      setAllTasks(prev => prev.map(t => t.id===taskId ? {...t, status} : t));
    } catch { toast.error('Failed to update'); }
  };

  const depts = ['all', ...Array.from(new Set(employees.map(e=>e.department).filter(Boolean)))];
  const filteredEmployees = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept==='all' || e.department===filterDept;
    return matchSearch && matchDept;
  });

  const totalScheduled = allTasks.filter(t=>t.scheduled_date && weekDays.some(d=>d.key===fmtDate(new Date(t.scheduled_date)))).length;
  const totalDone = allTasks.filter(t=>t.status==='done' && t.scheduled_date && weekDays.some(d=>d.key===fmtDate(new Date(t.scheduled_date)))).length;
  const totalUnplanned = allTasks.filter(t=>!t.scheduled_date).length;

  if (loading) return <div style={{textAlign:'center',padding:'60px 0',color:G.muted,fontSize:13}}>Loading employee data…</div>;

  return (
    <div style={{fontFamily:'Inter,sans-serif',color:G.text}}>
      {exportEmployee && <ExportModal employee={exportEmployee} weekStart={weekStart} onClose={()=>setExportEmployee(null)}/>}
      {showAddTask && (
        <AddTaskModal
          machines={[]} finishings={[]} orders={orders}
          initialValues={addTaskDefaults}
          onClose={()=>setShowAddTask(false)}
          onSuccess={()=>{ setShowAddTask(false); load(); toast.success('Task added'); }}
        />
      )}

      {/* Stats bar */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {[['Employees',filteredEmployees.length,'#a78bfa'],['Scheduled This Week',totalScheduled,'#f59e0b'],['Completed',totalDone,'#10b981'],['Unplanned',totalUnplanned,'#ef4444']].map(([label,val,accent])=>(
          <div key={label} style={{background:G.glass,border:`1px solid ${G.border}`,borderRadius:12,padding:'10px 20px',display:'flex',flexDirection:'column',alignItems:'center'}}>
            <span style={{fontSize:20,fontWeight:700,color:accent,fontFamily:'monospace'}}>{val}</span>
            <span style={{fontSize:10,color:G.subtle,textTransform:'uppercase',letterSpacing:1,marginTop:2}}>{label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:20,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:4,background:G.glass,border:`1px solid ${G.border}`,borderRadius:10,padding:'4px 8px'}}>
          <button onClick={prevWeek} style={{background:'none',border:'none',color:G.muted,cursor:'pointer',padding:'4px 8px',display:'flex',alignItems:'center'}}><FiChevronLeft size={16}/></button>
          <span style={{fontSize:13,color:G.text,fontWeight:600,minWidth:200,textAlign:'center'}}>{weekRangeStr}</span>
          <button onClick={nextWeek} style={{background:'none',border:'none',color:G.muted,cursor:'pointer',padding:'4px 8px',display:'flex',alignItems:'center'}}><FiChevronRight size={16}/></button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,background:G.glass,border:`1px solid ${G.border}`,borderRadius:10,padding:'6px 12px',flex:1,maxWidth:240}}>
          <FiSearch size={13} color={G.subtle}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees…" style={{background:'none',border:'none',color:G.text,fontSize:13,outline:'none',width:'100%'}}/>
        </div>
        <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{background:'#111',border:`1px solid ${G.border}`,color:G.muted,borderRadius:10,padding:'6px 12px',fontSize:13,cursor:'pointer'}}>
          {depts.map(d=><option key={d} value={d}>{d==='all'?'All Departments':d}</option>)}
        </select>
        <button onClick={()=>{setAddTaskDefaults({});setShowAddTask(true);}} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',background:'rgba(167,139,250,0.1)',border:'1px solid rgba(167,139,250,0.2)',color:'#a78bfa',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:600}}>
          <FiPlus size={14}/> Add Task
        </button>
      </div>

      {/* Calendar Grid */}
      {filteredEmployees.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0',color:G.muted}}>
          <FiUser size={36} style={{marginBottom:12,opacity:0.3}}/>
          <p style={{fontSize:14}}>No active employees found.</p>
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:900}}>
            <thead>
              <tr>
                <th style={{padding:'10px 12px',background:'rgba(255,255,255,0.04)',border:`1px solid ${G.border}`,color:G.subtle,fontSize:11,fontWeight:600,textAlign:'left',width:160,position:'sticky',left:0,zIndex:2}}>Employee</th>
                <th style={{padding:'10px 8px',background:'rgba(255,255,255,0.04)',border:`1px solid ${G.border}`,color:'#ef4444',fontSize:11,fontWeight:600,textAlign:'center',width:120}}>Unplanned</th>
                {weekDays.map(d=>(
                  <th key={d.key} style={{padding:'10px 8px',background:'rgba(255,255,255,0.04)',border:`1px solid ${G.border}`,color:G.muted,fontSize:11,fontWeight:600,textAlign:'center',minWidth:130}}>
                    <div style={{color:G.text}}>{d.label}</div>
                    <div style={{fontSize:10,color:G.subtle,marginTop:2}}>{d.short}</div>
                  </th>
                ))}
                <th style={{padding:'10px 8px',background:'rgba(255,255,255,0.04)',border:`1px solid ${G.border}`,color:G.subtle,fontSize:11,fontWeight:600,textAlign:'center',width:80}}>Export</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp=>{
                const unplanned = getUnplannedForEmployee(emp.name);
                const totalHours = allTasks.filter(t=>t.assigned_to===emp.name && t.scheduled_date && weekDays.some(d=>d.key===fmtDate(new Date(t.scheduled_date)))).reduce((s,t)=>s+(t.estimated_minutes||0),0)/60;
                return (
                  <tr key={emp.id}>
                    {/* Employee info */}
                    <td style={{padding:'8px 12px',border:`1px solid ${G.border}`,background:'rgba(255,255,255,0.02)',verticalAlign:'top',position:'sticky',left:0,zIndex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:G.text,marginBottom:2}}>{emp.name}</div>
                      <div style={{fontSize:10,color:G.subtle}}>{emp.job_title||emp.department||''}</div>
                      <div style={{fontSize:10,color:'#a78bfa',marginTop:4}}>{totalHours.toFixed(1)}h this week</div>
                    </td>
                    {/* Unplanned queue */}
                    <td style={{padding:8,border:`1px solid ${G.border}`,verticalAlign:'top',background:'rgba(239,68,68,0.03)'}}>
                      {unplanned.length===0
                        ? <div style={{fontSize:10,color:G.subtle,textAlign:'center',padding:'8px 0'}}>—</div>
                        : unplanned.map(t=><TaskCard key={t.id} task={t} onDragStart={()=>setDraggedTaskId(t.id)} isDragging={draggedTaskId===t.id} onUpdateStatus={handleUpdateStatus}/>)
                      }
                    </td>
                    {/* Day cells */}
                    {weekDays.map(d=>{
                      const dayTasks = getTasksForEmployeeDay(emp.name, d.key);
                      const isOver = dragOverCell===`${emp.id}-${d.key}`;
                      return (
                        <td key={d.key}
                          style={{padding:8,border:`1px solid ${G.border}`,verticalAlign:'top',background:isOver?'rgba(167,139,250,0.08)':'transparent',transition:'background 0.15s',minHeight:60}}
                          onDragOver={e=>{e.preventDefault();setDragOverCell(`${emp.id}-${d.key}`);}}
                          onDragLeave={()=>setDragOverCell(null)}
                          onDrop={e=>{e.preventDefault();handleDrop(emp.name,d.key);}}
                        >
                          {dayTasks.length===0
                            ? <div style={{fontSize:10,color:G.subtle,textAlign:'center',padding:'8px 0',borderRadius:6,border:`1px dashed rgba(255,255,255,0.06)`,cursor:'pointer'}} onClick={()=>{setAddTaskDefaults({assigned_to:emp.name,scheduled_date:d.key});setShowAddTask(true);}}>+ add</div>
                            : dayTasks.map(t=><TaskCard key={t.id} task={t} onDragStart={()=>setDraggedTaskId(t.id)} isDragging={draggedTaskId===t.id} onUpdateStatus={handleUpdateStatus}/>)
                          }
                        </td>
                      );
                    })}
                    {/* Export */}
                    <td style={{padding:8,border:`1px solid ${G.border}`,verticalAlign:'middle',textAlign:'center'}}>
                      <button onClick={()=>setExportEmployee(emp)} title="Export report" style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${G.border}`,color:G.muted,borderRadius:8,padding:'6px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:11,margin:'0 auto'}}>
                        <FiPrinter size={13}/> PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
