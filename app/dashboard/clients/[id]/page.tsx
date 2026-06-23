'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Phone, Mail, MapPin, Plus, Flame, Snowflake, Thermometer } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', closed_won: 'Won', closed_lost: 'Lost',
};
function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeal, setShowDeal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [dealForm, setDealForm] = useState({ title: '', value: '', stage: 'lead', temperature: 'warm', expected_close_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [c, u, m] = await Promise.all([
      fetch(`/api/clients/${id}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/me').then(r => r.json()),
    ]);
    setClient(c); setUsers(u); setMe(m);
    setForm({ name: c.name, company: c.company, phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '', assigned_to: c.assigned_to });
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function saveEdit() {
    setSaving(true); setError('');
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setShowEdit(false); load(); setSaving(false);
  }

  async function saveDeal() {
    setSaving(true); setError('');
    const res = await fetch('/api/deals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dealForm, client_id: id, value: Number(dealForm.value) || null, assigned_to: client.assigned_to }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setShowDeal(false);
    router.push(`/dashboard/deals/${data.id}`);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  if (!client || client.error) return <div className="p-6 text-slate-500">Client not found.</div>;

  const managers = users.filter((u: any) => u.role === 'manager');
  const activeDeals = client.deals?.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage)) || [];
  const closedDeals = client.deals?.filter((d: any) => ['closed_won', 'closed_lost'].includes(d.stage)) || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <Link href="/dashboard/clients" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-slate-500 text-sm flex-wrap">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{client.company}</span>
              {client.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{client.phone}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{client.email}</span>}
              {client.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{client.address}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDeal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Deal
            </button>
            {(me?.role === 'director' || client.assigned_to === me?.id) && (
              <button onClick={() => setShowEdit(true)} className="btn-secondary">Edit</button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Info sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <Row label="Zone" value={client.zone === 'south_west' ? 'South & West' : 'North'} />
              <Row label="Assigned To" value={client.assigned_user_name || 'Unassigned'} />
              <Row label="Added By" value={client.created_by_name} />
              <Row label="Added On" value={new Date(client.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
              <Row label="Active Deals" value={activeDeals.length} />
            </div>
            {client.notes && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Notes</div>
                <p className="text-sm text-slate-700">{client.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Deals */}
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Active Deals ({activeDeals.length})</h2>
            </div>
            {activeDeals.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No active deals</p>
                <button onClick={() => setShowDeal(true)} className="text-blue-600 text-sm mt-2 hover:underline">Add a deal</button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDeals.map((d: any) => <DealRow key={d.id} deal={d} />)}
              </div>
            )}
          </div>

          {closedDeals.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Closed Deals ({closedDeals.length})</h2>
              <div className="space-y-3">
                {closedDeals.map((d: any) => <DealRow key={d.id} deal={d} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <Modal title="Edit Client" onClose={() => setShowEdit(false)}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><label className="label">Company *</label><input className="input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            {me?.role === 'director' && (
              <div>
                <label className="label">Assign To</label>
                <select className="input" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                  {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setShowEdit(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </Modal>
      )}

      {/* New Deal Modal */}
      {showDeal && (
        <Modal title="Create New Deal" onClose={() => setShowDeal(false)}>
          <div className="space-y-4">
            <div><label className="label">Deal Title *</label><input className="input" value={dealForm.title} onChange={e => setDealForm({...dealForm, title: e.target.value})} placeholder="e.g. ERP Implementation - Q3" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Deal Value (₹)</label><input className="input" type="number" value={dealForm.value} onChange={e => setDealForm({...dealForm, value: e.target.value})} placeholder="e.g. 150000" /></div>
              <div>
                <label className="label">Stage</label>
                <select className="input" value={dealForm.stage} onChange={e => setDealForm({...dealForm, stage: e.target.value})}>
                  <option value="lead">Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                </select>
              </div>
              <div>
                <label className="label">Temperature</label>
                <select className="input" value={dealForm.temperature} onChange={e => setDealForm({...dealForm, temperature: e.target.value})}>
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">🌡 Warm</option>
                  <option value="cold">❄ Cold</option>
                </select>
              </div>
              <div>
                <label className="label">Expected Close Date {dealForm.stage !== 'lead' && '*'}</label>
                <input className="input" type="date" value={dealForm.expected_close_date} onChange={e => setDealForm({...dealForm, expected_close_date: e.target.value})} />
              </div>
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={dealForm.notes} onChange={e => setDealForm({...dealForm, notes: e.target.value})} placeholder="Initial context for this deal..." /></div>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setShowDeal(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveDeal} disabled={saving || !dealForm.title} className="btn-primary">{saving ? 'Creating...' : 'Create Deal'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700 font-medium text-right">{value}</span>
    </div>
  );
}

function DealRow({ deal }: { deal: any }) {
  const tempIcons: Record<string, any> = { hot: Flame, warm: Thermometer, cold: Snowflake };
  const TempIcon = tempIcons[deal.temperature] || Thermometer;
  const tempColors: Record<string, string> = { hot: 'text-red-500', warm: 'text-orange-500', cold: 'text-slate-400' };
  const stageBadge: Record<string, string> = {
    lead: 'stage-lead', qualified: 'stage-qualified', proposal: 'stage-proposal',
    negotiation: 'stage-negotiation', closed_won: 'stage-closed_won', closed_lost: 'stage-closed_lost',
  };
  const isStale = deal.is_stale && !['closed_won', 'closed_lost'].includes(deal.stage);
  return (
    <Link href={`/dashboard/deals/${deal.id}`}
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-blue-50 hover:border-blue-200 ${isStale ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center gap-3">
        <TempIcon className={`w-4 h-4 shrink-0 ${tempColors[deal.temperature]}`} />
        <div>
          <div className="font-medium text-sm text-slate-800">{deal.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadge[deal.stage] || ''}`}>
              {STAGE_LABELS[deal.stage]}
            </span>
            {isStale && <span className="text-xs text-amber-600 font-medium">{deal.days_since_contact}d no contact</span>}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <div className="font-semibold text-slate-800">{deal.value ? `₹${Number(deal.value).toLocaleString()}` : '—'}</div>
        {deal.expected_close_date && (
          <div className={`text-xs ${new Date(deal.expected_close_date) < new Date() ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            {new Date(deal.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>
    </Link>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
