'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Flame, Thermometer, Snowflake, AlertTriangle, Calendar, Search } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', closed_won: 'Won', closed_lost: 'Lost',
};
const STAGE_BADGE: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700', qualified: 'bg-blue-100 text-blue-700',
  proposal: 'bg-purple-100 text-purple-700', negotiation: 'bg-amber-100 text-amber-700',
  closed_won: 'bg-green-100 text-green-700', closed_lost: 'bg-red-100 text-red-600',
};
function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export default function DealsPage() {
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [stage, setStage] = useState('');
  const [temperature, setTemperature] = useState('');
  const [zone, setZone] = useState('');
  const [stale, setStale] = useState(searchParams.get('stale') === '1');
  const [search, setSearch] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (temperature) params.set('temperature', temperature);
    if (zone) params.set('zone', zone);
    if (stale) params.set('stale', '1');
    const [d, u, m] = await Promise.all([
      fetch(`/api/deals?${params}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/me').then(r => r.json()),
    ]);
    setDeals(d); setUsers(u); setMe(m); setLoading(false);
  }

  useEffect(() => { load(); }, [stage, temperature, zone, stale]);

  const filtered = deals.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.title?.toLowerCase().includes(q) || d.client_name?.toLowerCase().includes(q) || d.client_company?.toLowerCase().includes(q);
  });

  const pipelineValue = filtered.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((sum, d) => sum + (d.value || 0), 0);
  const staleCount = filtered.filter(d => d.is_stale).length;
  const hotCount = filtered.filter(d => d.temperature === 'hot' && !['closed_won', 'closed_lost'].includes(d.stage)).length;
  const managers = users.filter((u: any) => u.role === 'manager');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals Pipeline</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            <span>{filtered.length} deals</span>
            <span>Pipeline: <span className="font-semibold text-slate-700">{fmt(pipelineValue)}</span></span>
            {hotCount > 0 && <span className="text-red-600 font-medium">{hotCount} hot</span>}
            {staleCount > 0 && <span className="text-amber-600 font-medium">{staleCount} stale</span>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-56" placeholder="Search deals..." />
        </div>
        <select value={stage} onChange={e => setStage(e.target.value)} className="input w-40">
          <option value="">All Stages</option>
          {Object.entries(STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={temperature} onChange={e => setTemperature(e.target.value)} className="input w-36">
          <option value="">All Temp</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">🌡 Warm</option>
          <option value="cold">❄ Cold</option>
        </select>
        {me?.role === 'director' && (
          <select value={zone} onChange={e => setZone(e.target.value)} className="input w-40">
            <option value="">All Zones</option>
            <option value="south_west">South & West</option>
            <option value="north">North</option>
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={stale} onChange={e => setStale(e.target.checked)}
            className="rounded border-slate-300 text-amber-500" />
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Stale only
        </label>
      </div>

      {/* Deals Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Deal', 'Client', 'Stage', 'Temp', 'Value', 'Expected Close', 'Last Contact', 'Slips', 'Manager', ''].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="py-12 text-center text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-slate-400">No deals found</td></tr>
              ) : filtered.map((d: any) => {
                const isStale = d.is_stale && !['closed_won', 'closed_lost'].includes(d.stage);
                const isPastClose = d.expected_close_date && new Date(d.expected_close_date) < new Date() && !['closed_won', 'closed_lost'].includes(d.stage);
                return (
                  <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${isStale ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3 max-w-xs">
                      <Link href={`/dashboard/deals/${d.id}`} className="font-medium text-blue-600 hover:underline line-clamp-1">{d.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <div>{d.client_name}</div>
                      <div className="text-xs text-slate-400">{d.client_company}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[d.stage]}`}>
                        {STAGE_LABELS[d.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <TempBadge temp={d.temperature} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {d.value ? fmt(d.value) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.expected_close_date ? (
                        <span className={`flex items-center gap-1 ${isPastClose ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                          {isPastClose && <AlertTriangle className="w-3.5 h-3.5" />}
                          {new Date(d.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : (
                        ['closed_won', 'closed_lost'].includes(d.stage) ? <span className="text-slate-300">—</span> :
                        <span className="text-red-500 text-xs font-medium">NOT SET</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.days_since_contact !== null ? (
                        <span className={d.is_stale ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                          {d.days_since_contact === 0 ? 'Today' : `${d.days_since_contact}d ago`}
                        </span>
                      ) : <span className="text-red-500 text-xs font-medium">NEVER</span>}
                    </td>
                    <td className="px-4 py-3">
                      {d.close_date_change_count > 0 ? (
                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-semibold">
                          {d.close_date_change_count}×
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{d.assigned_user_name}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/deals/${d.id}`}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1 rounded-md font-medium transition-colors">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TempBadge({ temp }: { temp: string }) {
  if (temp === 'hot') return <span className="flex items-center gap-1 text-red-600 font-medium text-xs"><Flame className="w-3.5 h-3.5" />Hot</span>;
  if (temp === 'warm') return <span className="flex items-center gap-1 text-orange-500 text-xs"><Thermometer className="w-3.5 h-3.5" />Warm</span>;
  return <span className="flex items-center gap-1 text-slate-400 text-xs"><Snowflake className="w-3.5 h-3.5" />Cold</span>;
}
