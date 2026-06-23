'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, CheckCircle2, Clock, AlertTriangle, CheckSquare } from 'lucide-react';

const PRI_BADGE: Record<string, string> = {
  urgent: 'priority-urgent', high: 'priority-high', medium: 'priority-medium', low: 'priority-low',
};
const STATUS_BADGE: Record<string, string> = {
  pending: 'status-pending', in_progress: 'status-in_progress',
  completed: 'status-completed', overdue: 'status-overdue',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium', deal_id: '', client_id: '' });
  const [completing, setCompleting] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const [t, u, m] = await Promise.all([
      fetch(`/api/tasks?${params}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/me').then(r => r.json()),
    ]);
    setTasks(t); setUsers(u); setMe(m);
    if (!form.assigned_to && m) setForm(f => ({ ...f, assigned_to: String(m.id) }));
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function saveTask() {
    setSaving(true); setError('');
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, deal_id: form.deal_id || null, client_id: form.client_id || null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setShowAdd(false);
    setForm({ title: '', description: '', assigned_to: String(me?.id), due_date: '', priority: 'medium', deal_id: '', client_id: '' });
    load(); setSaving(false);
  }

  async function completeTask(id: number) {
    const note = completing[id];
    if (!note || note.trim().length < 3) {
      setCompleting(prev => ({ ...prev, [id]: prev[id] || '' }));
      return;
    }
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completion_note: note }),
    });
    setCompleting(prev => { const n = { ...prev }; delete n[id]; return n; });
    load();
  }

  const overdue = tasks.filter(t => t.status === 'overdue');
  const pending = tasks.filter(t => ['pending', 'in_progress'].includes(t.status));
  const done = tasks.filter(t => t.status === 'completed');
  const managers = users.filter((u: any) => u.role === 'manager');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {overdue.length > 0 && <span className="text-red-600 font-semibold">{overdue.length} overdue · </span>}
            {pending.length} pending · {done.length} completed
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {[['', 'All'], ['overdue', 'Overdue'], ['pending', 'Pending'], ['in_progress', 'In Progress'], ['completed', 'Completed']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === v ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No tasks found</div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t: any) => {
            const isOver = t.status === 'overdue';
            const isDone = t.status === 'completed';
            const showCompleteInput = completing.hasOwnProperty(t.id);
            return (
              <div key={t.id} className={`card p-4 ${isOver ? 'border-red-200 bg-red-50/30' : isDone ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : isOver ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`font-medium text-slate-800 ${isDone ? 'line-through text-slate-400' : ''}`}>{t.title}</div>
                        {t.description && <p className="text-sm text-slate-500 mt-0.5">{t.description}</p>}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRI_BADGE[t.priority]}`}>{t.priority}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[t.status]}`}>{t.status.replace('_', ' ')}</span>
                          <span className={`text-xs ${isOver ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                            Due: {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {isOver && ' — OVERDUE'}
                          </span>
                          <span className="text-xs text-slate-400">Assigned: {t.assigned_user_name}</span>
                          {t.creator_name && t.creator_name !== t.assigned_user_name && (
                            <span className="text-xs text-slate-400">By: {t.creator_name}</span>
                          )}
                        </div>
                        {(t.deal_title || t.client_name) && (
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                            {t.deal_title && <Link href={`/dashboard/deals/${t.deal_id}`} className="text-blue-500 hover:underline">{t.deal_title}</Link>}
                            {t.client_name && <span>{t.client_name} · {t.client_company}</span>}
                          </div>
                        )}
                        {isDone && t.completion_note && (
                          <div className="mt-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                            ✓ {t.completion_note}
                          </div>
                        )}
                      </div>
                      {!isDone && (t.assigned_to === me?.id || me?.role === 'director') && (
                        <div className="shrink-0">
                          {showCompleteInput ? (
                            <div className="flex items-center gap-2">
                              <input
                                className="input w-48 text-xs py-1"
                                placeholder="Completion note..."
                                value={completing[t.id] || ''}
                                onChange={e => setCompleting(prev => ({ ...prev, [t.id]: e.target.value }))}
                              />
                              <button onClick={() => completeTask(t.id)} className="btn-primary text-xs py-1 px-2">Done</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCompleting(prev => ({ ...prev, [t.id]: '' }))}
                              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1">
                              <CheckSquare className="w-3.5 h-3.5" /> Mark Done
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Create New Task</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Task Title *</label>
                <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="What needs to be done?" />
              </div>
              <div>
                <label className="label">Details</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Additional context..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {me?.role === 'director' && (
                  <div>
                    <label className="label">Assign To *</label>
                    <select className="input" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                      <option value="">Select person</option>
                      {[...managers, ...(users.filter((u: any) => u.id === me?.id))].map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Due Date *</label>
                  <input className="input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                <button onClick={saveTask} disabled={saving || !form.title || !form.due_date} className="btn-primary">
                  {saving ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
