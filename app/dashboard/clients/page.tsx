'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, Building2, Phone } from 'lucide-react';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', address: '', zone: 'south_west', assigned_to: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (zone) params.set('zone', zone);
    const [c, u, me] = await Promise.all([
      fetch(`/api/clients?${params}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/me').then(r => r.json()),
    ]);
    setClients(c); setUsers(u); setUser(me); setLoading(false);
  }

  useEffect(() => { load(); }, [search, zone]);

  async function saveClient() {
    setSaving(true); setError('');
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, assigned_to: form.assigned_to || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setShowAdd(false);
    setForm({ name: '', company: '', phone: '', email: '', address: '', zone: 'south_west', assigned_to: '', notes: '' });
    load();
    setSaving(false);
  }

  const managers = users.filter((u: any) => u.role === 'manager');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 text-sm mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''} found</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9" placeholder="Search name, company, phone..." />
        </div>
        {user?.role === 'director' && (
          <select value={zone} onChange={e => setZone(e.target.value)} className="input w-48">
            <option value="">All Zones</option>
            <option value="south_west">South &amp; West</option>
            <option value="north">North</option>
          </select>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Client / Company', 'Zone', 'Contact', 'Assigned To', 'Deals', 'Added', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No clients found</td></tr>
              ) : clients.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-blue-600 hover:underline">{c.name}</Link>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" />{c.company}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.zone === 'south_west' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {c.zone === 'south_west' ? 'South & West' : 'North'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</div>}
                    {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.assigned_user_name || <span className="text-red-500">Unassigned</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${Number(c.deal_count) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                      {c.deal_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/clients/${c.id}`}
                      className="text-xs text-blue-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      {showAdd && (
        <Modal title="Add New Client" onClose={() => setShowAdd(false)}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Company *</label>
              <input className="input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Company name" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Mobile number" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@company.com" />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="City, State" />
            </div>
            <div>
              <label className="label">Zone *</label>
              <select className="input" value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}>
                <option value="south_west">South &amp; West</option>
                <option value="north">North</option>
              </select>
            </div>
            {user?.role === 'director' && (
              <div>
                <label className="label">Assign To</label>
                <select className="input" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                  <option value="">Select manager</option>
                  {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Key information about this client..." />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveClient} disabled={saving || !form.name || !form.company} className="btn-primary">
              {saving ? 'Saving...' : 'Add Client'}
            </button>
          </div>
        </Modal>
      )}
    </div>
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
