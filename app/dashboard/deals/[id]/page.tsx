'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Flame, Thermometer, Snowflake, AlertTriangle,
  Phone, Mail, MessageSquare, Calendar, Clock, CheckSquare,
  TrendingUp, ChevronRight, Info,
} from 'lucide-react';

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', closed_won: 'Won', closed_lost: 'Lost',
};
const ACTIVITY_ICONS: Record<string, string> = {
  created: '✦', call: '📞', email: '📧', meeting: '🤝', note: '📝',
  stage_change: '→', temperature_change: '🌡', close_date_change: '📅',
  assignment_change: '👤', value_change: '₹',
};
function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export default function DealDetailPage() {
  const { id } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Activity form
  const [actForm, setActForm] = useState({ activity_type: 'call', description: '', contact_date: new Date().toISOString().split('T')[0] });

  // Stage change form
  const [stageForm, setStageForm] = useState({ stage: '', stage_note: '', loss_reason: '', last_contact_summary: '', expected_close_date: '' });

  // Temperature form
  const [tempForm, setTempForm] = useState({ temperature: '', temperature_note: '' });

  // Close date form
  const [dateForm, setDateForm] = useState({ expected_close_date: '', close_date_reason: '' });

  // Contact form
  const [contactForm, setContactForm] = useState({ last_contact_date: new Date().toISOString().split('T')[0], last_contact_summary: '', contact_type: 'call' });

  // Assign form
  const [assignForm, setAssignForm] = useState({ assigned_to: '' });

  // Value form
  const [valueForm, setValueForm] = useState({ value: '' });

  // Task form
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '', priority: 'high' });

  async function load() {
    const [d, m, u] = await Promise.all([
      fetch(`/api/deals/${id}`).then(r => r.json()),
      fetch('/api/me').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]);
    setDeal(d); setMe(m); setUsers(u);
    setStageForm(f => ({ ...f, stage: d.stage }));
    setTempForm(f => ({ ...f, temperature: d.temperature }));
    setDateForm(f => ({ ...f, expected_close_date: d.expected_close_date || '' }));
    setValueForm({ value: d.value || '' });
    setAssignForm({ assigned_to: d.assigned_to || '' });
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function patchDeal(body: any) {
    setSaving(true); setError(''); setSuccess('');
    const res = await fetch(`/api/deals/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return false; }
    setSuccess('Saved successfully');
    setActivePanel(null);
    setTimeout(() => setSuccess(''), 3000);
    await load();
    setSaving(false);
    return true;
  }

  async function logActivity() {
    if (actForm.description.trim().length < 15) { setError('Description must be at least 15 characters.'); return; }
    setSaving(true); setError('');
    const res = await fetch(`/api/deals/${id}/activity`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actForm),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setActForm({ activity_type: 'call', description: '', contact_date: new Date().toISOString().split('T')[0] });
    setActivePanel(null);
    setSuccess('Activity logged');
    setTimeout(() => setSuccess(''), 3000);
    await load();
    setSaving(false);
  }

  async function createTask() {
    setSaving(true); setError('');
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...taskForm, assigned_to: deal.assigned_to, deal_id: id }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setTaskForm({ title: '', description: '', due_date: '', priority: 'high' });
    setActivePanel(null);
    setSuccess('Task created');
    setTimeout(() => setSuccess(''), 3000);
    await load();
    setSaving(false);
  }

  async function updateTask(taskId: number, status: string, completion_note?: string) {
    setSaving(true);
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, completion_note: completion_note || 'Completed' }),
    });
    await load();
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  if (!deal || deal.error) return <div className="p-6 text-slate-500">Deal not found.</div>;

  const isOwner = me?.id === deal.assigned_to;
  const isDirector = me?.role === 'director';
  const canEdit = isOwner || isDirector;
  const isClosed = ['closed_won', 'closed_lost'].includes(deal.stage);
  const isPastClose = deal.expected_close_date && new Date(deal.expected_close_date) < new Date() && !isClosed;
  const managers = users.filter((u: any) => u.role === 'manager');
  const stageIdx = STAGES.indexOf(deal.stage);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/dashboard/deals" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Deals
      </Link>

      {/* Deal Header */}
      <div className={`card p-6 mb-5 ${deal.is_stale && !isClosed ? 'border-amber-300 bg-amber-50/50' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{deal.title}</h1>
              <TempIcon temp={deal.temperature} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                deal.stage === 'closed_won' ? 'bg-green-100 text-green-700' :
                deal.stage === 'closed_lost' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>{STAGE_LABELS[deal.stage]}</span>
              {deal.is_stale && !isClosed && (
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                  <AlertTriangle className="w-3 h-3" /> STALE
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
              <Link href={`/dashboard/clients/${deal.client_id}`} className="hover:text-blue-600">
                {deal.client_name} · {deal.client_company}
              </Link>
              <span>Managed by: <span className="text-slate-700 font-medium">{deal.assigned_user_name}</span></span>
              {deal.client_phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{deal.client_phone}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-slate-900">{deal.value ? fmt(deal.value) : '—'}</div>
            <div className="text-xs text-slate-400">Deal Value</div>
          </div>
        </div>

        {/* Stage progress */}
        {!isClosed && (
          <div className="mt-5">
            <div className="flex items-center gap-1">
              {['lead', 'qualified', 'proposal', 'negotiation'].map((s, i) => {
                const done = stageIdx > i;
                const active = stageIdx === i;
                return (
                  <div key={s} className="flex items-center flex-1">
                    <div className={`text-xs px-2 py-1 rounded text-center flex-1 font-medium ${
                      active ? 'bg-blue-600 text-white' : done ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                    }`}>{STAGE_LABELS[s]}</div>
                    {i < 3 && <ChevronRight className={`w-3 h-3 shrink-0 ${done || active ? 'text-blue-400' : 'text-slate-300'}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Key metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Metric label="Expected Close"
            value={deal.expected_close_date
              ? new Date(deal.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Not Set'}
            urgent={isPastClose || !deal.expected_close_date}
            note={isPastClose ? 'PAST DUE' : !deal.expected_close_date ? 'Required!' : undefined}
          />
          <Metric label="Last Contact"
            value={deal.last_contact_date
              ? `${deal.days_since_contact === 0 ? 'Today' : `${deal.days_since_contact} days ago`}`
              : 'Never'}
            urgent={deal.is_stale && !isClosed}
            note={deal.is_stale && !isClosed ? `${deal.days_since_contact ?? '?'}d no contact` : undefined}
          />
          <Metric label="Date Slips"
            value={deal.close_date_change_count}
            urgent={deal.close_date_change_count >= 2}
            note={deal.close_date_change_count > 0 ? 'Close date pushed' : undefined}
          />
          <Metric label="Created"
            value={new Date(deal.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          />
        </div>

        {deal.last_contact_summary && (
          <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-slate-700">
            <span className="text-xs font-semibold text-blue-600 block mb-0.5">Last Contact Summary</span>
            {deal.last_contact_summary}
          </div>
        )}

        {success && <div className="mt-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">{success}</div>}
        {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>}
      </div>

      {/* Action Buttons */}
      {canEdit && !isClosed && (
        <div className="flex flex-wrap gap-2 mb-5">
          <ActionBtn label="Log Activity" active={activePanel === 'activity'} onClick={() => setActivePanel(activePanel === 'activity' ? null : 'activity')} color="blue" />
          <ActionBtn label="Update Contact" active={activePanel === 'contact'} onClick={() => setActivePanel(activePanel === 'contact' ? null : 'contact')} color="green" />
          <ActionBtn label="Change Stage" active={activePanel === 'stage'} onClick={() => setActivePanel(activePanel === 'stage' ? null : 'stage')} color="purple" />
          <ActionBtn label="Change Temperature" active={activePanel === 'temp'} onClick={() => setActivePanel(activePanel === 'temp' ? null : 'temp')} color="orange" />
          <ActionBtn label="Update Close Date" active={activePanel === 'date'} onClick={() => setActivePanel(activePanel === 'date' ? null : 'date')} color="amber" />
          <ActionBtn label="Update Value" active={activePanel === 'value'} onClick={() => setActivePanel(activePanel === 'value' ? null : 'value')} color="teal" />
          {isDirector && <ActionBtn label="Reassign Deal" active={activePanel === 'assign'} onClick={() => setActivePanel(activePanel === 'assign' ? null : 'assign')} color="slate" />}
          {isDirector && <ActionBtn label="Add Task" active={activePanel === 'task'} onClick={() => setActivePanel(activePanel === 'task' ? null : 'task')} color="indigo" />}
        </div>
      )}

      {/* Action Panels */}
      {activePanel && (
        <div className="card p-5 mb-5 border-blue-200 bg-blue-50/30">
          {activePanel === 'activity' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Log Activity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Activity Type *</label>
                  <select className="input" value={actForm.activity_type} onChange={e => setActForm({...actForm, activity_type: e.target.value})}>
                    <option value="call">📞 Phone Call</option>
                    <option value="email">📧 Email</option>
                    <option value="meeting">🤝 Meeting</option>
                    <option value="note">📝 Internal Note</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date</label>
                  <input className="input" type="date" value={actForm.contact_date} onChange={e => setActForm({...actForm, contact_date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">What happened? * <span className="text-slate-400 font-normal">(min 15 chars — no shortcuts)</span></label>
                <textarea className="input" rows={3} value={actForm.description}
                  onChange={e => setActForm({...actForm, description: e.target.value})}
                  placeholder="Be specific: who you spoke to, what was discussed, what was agreed, what's the next step..." />
                <div className={`text-xs mt-1 ${actForm.description.length < 15 ? 'text-red-400' : 'text-green-600'}`}>
                  {actForm.description.length} / 15 min chars
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={logActivity} disabled={saving || actForm.description.length < 15} className="btn-primary">{saving ? 'Saving...' : 'Log Activity'}</button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {activePanel === 'contact' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Update Last Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact Type</label>
                  <select className="input" value={contactForm.contact_type} onChange={e => setContactForm({...contactForm, contact_type: e.target.value})}>
                    <option value="call">📞 Phone Call</option>
                    <option value="email">📧 Email</option>
                    <option value="meeting">🤝 Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date of Contact *</label>
                  <input className="input" type="date" value={contactForm.last_contact_date} onChange={e => setContactForm({...contactForm, last_contact_date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">What was discussed? * <span className="text-slate-400 font-normal">(min 15 chars)</span></label>
                <textarea className="input" rows={3} value={contactForm.last_contact_summary}
                  onChange={e => setContactForm({...contactForm, last_contact_summary: e.target.value})}
                  placeholder="Summarize the conversation: key points, client feedback, objections, next steps..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => patchDeal({ ...contactForm })} disabled={saving || contactForm.last_contact_summary.length < 15} className="btn-primary">
                  {saving ? 'Saving...' : 'Update Contact'}
                </button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {activePanel === 'stage' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Change Stage</h3>
              {!isDirector && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  You can only move a deal forward. Only the director can move it backward.
                </div>
              )}
              <div>
                <label className="label">New Stage *</label>
                <select className="input" value={stageForm.stage} onChange={e => setStageForm({...stageForm, stage: e.target.value})}>
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              {stageForm.stage === 'closed_lost' && (
                <div>
                  <label className="label">Loss Reason * <span className="text-red-500">(required)</span></label>
                  <textarea className="input" rows={2} value={stageForm.loss_reason}
                    onChange={e => setStageForm({...stageForm, loss_reason: e.target.value})}
                    placeholder="Why was this deal lost? Competitor, budget, no decision, timing...?" />
                </div>
              )}
              {(stageForm.stage !== 'lead') && !deal.expected_close_date && stageForm.stage !== 'closed_lost' && (
                <div>
                  <label className="label">Expected Close Date * <span className="text-red-500">(required to move past Lead)</span></label>
                  <input className="input" type="date" value={stageForm.expected_close_date}
                    onChange={e => setStageForm({...stageForm, expected_close_date: e.target.value})} />
                </div>
              )}
              <div>
                <label className="label">Note on this change</label>
                <input className="input" value={stageForm.stage_note}
                  onChange={e => setStageForm({...stageForm, stage_note: e.target.value})}
                  placeholder="What led to this stage change?" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => patchDeal({
                  stage: stageForm.stage, stage_note: stageForm.stage_note,
                  loss_reason: stageForm.loss_reason || undefined,
                  expected_close_date: stageForm.expected_close_date || undefined,
                })} disabled={saving || stageForm.stage === deal.stage} className="btn-primary">
                  {saving ? 'Saving...' : 'Change Stage'}
                </button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {activePanel === 'temp' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Change Temperature</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                Reason is mandatory — this is tracked and visible to the director.
              </div>
              <div>
                <label className="label">Temperature *</label>
                <select className="input" value={tempForm.temperature} onChange={e => setTempForm({...tempForm, temperature: e.target.value})}>
                  <option value="hot">🔥 Hot — Active buying intent, likely to close soon</option>
                  <option value="warm">🌡 Warm — Interested but not urgent</option>
                  <option value="cold">❄ Cold — Low priority, long cycle or disengaged</option>
                </select>
              </div>
              <div>
                <label className="label">Reason for change * <span className="text-slate-400 font-normal">(min 10 chars)</span></label>
                <textarea className="input" rows={2} value={tempForm.temperature_note}
                  onChange={e => setTempForm({...tempForm, temperature_note: e.target.value})}
                  placeholder="What changed? What makes it hotter/cooler now?" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => patchDeal({ temperature: tempForm.temperature, temperature_note: tempForm.temperature_note })}
                  disabled={saving || tempForm.temperature === deal.temperature || tempForm.temperature_note.length < 10} className="btn-primary">
                  {saving ? 'Saving...' : 'Update Temperature'}
                </button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {activePanel === 'date' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Update Expected Close Date</h3>
              {deal.close_date_change_count > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  This deal's close date has been pushed {deal.close_date_change_count} time{deal.close_date_change_count > 1 ? 's' : ''} already.
                  Each change is permanently recorded and visible to the director.
                </div>
              )}
              <div>
                <label className="label">New Expected Close Date *</label>
                <input className="input" type="date" value={dateForm.expected_close_date}
                  onChange={e => setDateForm({...dateForm, expected_close_date: e.target.value})} />
              </div>
              {deal.expected_close_date && (
                <div>
                  <label className="label">Reason for pushing date * <span className="text-red-500">(required, permanently logged)</span></label>
                  <textarea className="input" rows={2} value={dateForm.close_date_reason}
                    onChange={e => setDateForm({...dateForm, close_date_reason: e.target.value})}
                    placeholder="Why is the close date being pushed? Client delay, proposal revision, budget approval...?" />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => patchDeal(dateForm)} disabled={saving || !dateForm.expected_close_date} className="btn-primary">
                  {saving ? 'Saving...' : 'Update Date'}
                </button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {activePanel === 'value' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Update Deal Value</h3>
              <div>
                <label className="label">Deal Value (₹)</label>
                <input className="input" type="number" value={valueForm.value}
                  onChange={e => setValueForm({ value: e.target.value })} placeholder="e.g. 250000" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => patchDeal({ value: Number(valueForm.value) })} disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Update Value'}
                </button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {activePanel === 'assign' && isDirector && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Reassign Deal</h3>
              <div>
                <label className="label">Assign To</label>
                <select className="input" value={assignForm.assigned_to} onChange={e => setAssignForm({ assigned_to: e.target.value })}>
                  {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => patchDeal(assignForm)} disabled={saving} className="btn-primary">Reassign</button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {activePanel === 'task' && isDirector && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Add Task for {deal.assigned_user_name}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Task Title *</label>
                  <input className="input" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} placeholder="What needs to be done?" />
                </div>
                <div>
                  <label className="label">Due Date *</label>
                  <input className="input" type="date" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})}>
                    <option value="urgent">🔴 Urgent</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Details</label>
                  <textarea className="input" rows={2} value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} placeholder="Additional instructions..." />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={createTask} disabled={saving || !taskForm.title || !taskForm.due_date} className="btn-primary">{saving ? 'Creating...' : 'Create Task'}</button>
                <button onClick={() => setActivePanel(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-5">Activity Timeline
              <span className="text-xs font-normal text-slate-400 ml-2">— immutable audit trail</span>
            </h2>
            {deal.activities?.length === 0 ? (
              <p className="text-slate-400 text-sm">No activity yet.</p>
            ) : (
              <div className="space-y-0">
                {[...deal.activities].reverse().map((a: any, i: number) => (
                  <div key={a.id} className="flex gap-3 pb-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm shrink-0">
                        {ACTIVITY_ICONS[a.activity_type] || '•'}
                      </div>
                      {i < deal.activities.length - 1 && <div className="w-0.5 bg-slate-100 flex-1 mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {a.activity_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{a.description}</p>
                      {(a.old_value || a.new_value) && (
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          {a.old_value && <span className="line-through">{a.old_value}</span>}
                          {a.old_value && a.new_value && <ChevronRight className="w-3 h-3" />}
                          {a.new_value && <span className="text-slate-600">{a.new_value}</span>}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-0.5">by {a.user_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tasks & Notes */}
        <div className="space-y-5">
          {/* Tasks */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-slate-500" /> Tasks ({deal.tasks?.length || 0})
            </h3>
            {deal.tasks?.length === 0 ? (
              <p className="text-slate-400 text-sm">No tasks.</p>
            ) : (
              <div className="space-y-2">
                {deal.tasks.map((t: any) => {
                  const isOver = t.status === 'overdue';
                  return (
                    <div key={t.id} className={`p-3 rounded-lg border text-sm ${isOver ? 'bg-red-50 border-red-200' : t.status === 'completed' ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={`font-medium ${t.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5">Due: {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {t.assigned_user_name}</div>
                        </div>
                        {t.status !== 'completed' && canEdit && (
                          <button onClick={() => updateTask(t.id, 'completed', 'Done')}
                            className="text-xs text-green-600 hover:text-green-700 shrink-0">Done</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          {deal.notes && (
            <div className="card p-4">
              <h3 className="font-semibold text-slate-800 mb-2 text-sm">Deal Notes</h3>
              <p className="text-sm text-slate-600">{deal.notes}</p>
            </div>
          )}

          {/* Loss reason */}
          {deal.stage === 'closed_lost' && deal.loss_reason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-700 mb-1 text-sm">Loss Reason</h3>
              <p className="text-sm text-red-600">{deal.loss_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, urgent, note }: { label: string; value: any; urgent?: boolean; note?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`font-semibold text-sm mt-0.5 ${urgent ? 'text-red-600' : 'text-slate-800'}`}>{value}</div>
      {note && <div className="text-xs text-red-500 font-medium">{note}</div>}
    </div>
  );
}

function TempIcon({ temp }: { temp: string }) {
  if (temp === 'hot') return <span className="flex items-center gap-1 text-red-500 text-sm font-medium"><Flame className="w-4 h-4" />Hot</span>;
  if (temp === 'warm') return <span className="flex items-center gap-1 text-orange-500 text-sm"><Thermometer className="w-4 h-4" />Warm</span>;
  return <span className="flex items-center gap-1 text-slate-400 text-sm"><Snowflake className="w-4 h-4" />Cold</span>;
}

function ActionBtn({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700', green: 'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700', orange: 'bg-orange-500 hover:bg-orange-600',
    amber: 'bg-amber-500 hover:bg-amber-600', teal: 'bg-teal-600 hover:bg-teal-700',
    slate: 'bg-slate-600 hover:bg-slate-700', indigo: 'bg-indigo-600 hover:bg-indigo-700',
  };
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors ${active ? 'ring-2 ring-offset-1 ring-blue-400' : ''} ${colors[color] || colors.blue}`}>
      {label}
    </button>
  );
}
