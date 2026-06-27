'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, TrendingUp, BarChart3, Calendar } from 'lucide-react';

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetForm, setTargetForm] = useState<Record<number, { revenue: string; deals: string }>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  async function load() {
    const now = new Date();
    const [me_, s, t] = await Promise.all([
      fetch('/api/me').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
      fetch(`/api/targets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then(r => r.json()),
    ]);
    if (!['director', 'cmd'].includes(me_.role)) { router.push('/dashboard'); return; }
    setMe(me_); setStats(s); setTargets(t);
    const tf: Record<number, { revenue: string; deals: string }> = {};
    t.forEach((tg: any) => { tf[tg.user_id] = { revenue: String(tg.revenue_target || ''), deals: String(tg.deal_count_target || '') }; });
    setTargetForm(tf);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveTargets() {
    setSaving(true);
    const now = new Date();
    for (const [userId, vals] of Object.entries(targetForm)) {
      await fetch('/api/targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(userId), month: now.getMonth() + 1, year: now.getFullYear(),
          revenue_target: Number(vals.revenue) || null, deal_count_target: Number(vals.deals) || null,
        }),
      });
    }
    setSuccess('Targets saved!'); setTimeout(() => setSuccess(''), 3000);
    load(); setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Director view — complete pipeline visibility · {monthName}</p>
      </div>

      {/* Pipeline Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pipeline', value: fmt(stats.pipeline_value), sub: `${stats.total_deals} active deals` },
          { label: 'Won This Month', value: stats.closed_won_month, sub: stats.closed_won_value_month > 0 ? fmt(stats.closed_won_value_month) : 'Keep pushing!' },
          { label: 'Stale Deals', value: stats.stale_deals, sub: 'No contact 14+ days', urgent: stats.stale_deals > 0 },
          { label: 'Overdue Tasks', value: stats.overdue_tasks, sub: 'Need attention', urgent: stats.overdue_tasks > 0 },
        ].map(({ label, value, sub, urgent }) => (
          <div key={label} className={`card p-4 ${urgent ? 'border-red-200 bg-red-50/30' : ''}`}>
            <div className={`text-2xl font-bold ${urgent ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">{label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Zone Performance */}
      {stats.zone_stats?.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" /> Zone-wise Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.zone_stats.map((z: any) => (
              <div key={z.zone} className="bg-slate-50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-bold text-slate-800">{z.manager_name}</div>
                    <div className="text-sm text-slate-500">{z.zone === 'south_west' ? 'South & West Zone' : 'North Zone'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-slate-900">{fmt(z.pipeline_value)}</div>
                    <div className="text-xs text-slate-400">Pipeline</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Active" value={z.total_deals} />
                  <Stat label="Hot" value={z.hot_deals} color={z.hot_deals > 0 ? 'text-red-600' : undefined} />
                  <Stat label="Stale" value={z.stale_deals} color={z.stale_deals > 0 ? 'text-amber-600' : 'text-green-600'} />
                  <Stat label="Won (Month)" value={z.closed_won_month} color={z.closed_won_month > 0 ? 'text-green-600' : undefined} />
                  <Stat label="Avg Last Contact" value={`${Math.round(z.avg_days_since_contact)}d`} color={z.avg_days_since_contact > 10 ? 'text-red-600' : undefined} />
                  <Stat label="Date Slips" value={z.date_slips_total} color={z.date_slips_total > 2 ? 'text-amber-600' : undefined} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Targets */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" /> Monthly Targets — {monthName}
          </h2>
          <div className="flex items-center gap-3">
            {success && <span className="text-green-600 text-sm font-medium">{success}</span>}
            <button onClick={saveTargets} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save Targets'}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Manager', 'Zone', 'Revenue Target', 'Revenue Achieved', 'Achievement %', 'Deal Target', 'Deals Closed', 'Achievement %'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold pb-3 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targets.map((t: any) => {
                const revPct = t.revenue_target ? Math.round((t.achieved_revenue / t.revenue_target) * 100) : null;
                const dealPct = t.deal_count_target ? Math.round((t.achieved_deals / t.deal_count_target) * 100) : null;
                return (
                  <tr key={t.user_id} className="border-b border-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-800">{t.user_name}</td>
                    <td className="py-3 pr-4 text-slate-500">{t.zone === 'south_west' ? 'South & West' : 'North'}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">₹</span>
                        <input type="number" className="border border-slate-200 rounded px-2 py-1 text-sm w-24"
                          value={targetForm[t.user_id]?.revenue || ''}
                          onChange={e => setTargetForm(prev => ({ ...prev, [t.user_id]: { ...prev[t.user_id], revenue: e.target.value } }))} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-medium">{t.achieved_revenue > 0 ? fmt(t.achieved_revenue) : '—'}</td>
                    <td className="py-3 pr-4">
                      {revPct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${revPct >= 100 ? 'bg-green-500' : revPct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(revPct, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${revPct >= 100 ? 'text-green-600' : revPct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{revPct}%</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <input type="number" className="border border-slate-200 rounded px-2 py-1 text-sm w-16"
                        value={targetForm[t.user_id]?.deals || ''}
                        onChange={e => setTargetForm(prev => ({ ...prev, [t.user_id]: { ...prev[t.user_id], deals: e.target.value } }))} />
                    </td>
                    <td className="py-3 pr-4 font-medium">{t.achieved_deals || '—'}</td>
                    <td className="py-3 pr-4">
                      {dealPct !== null ? (
                        <span className={`font-semibold ${dealPct >= 100 ? 'text-green-600' : dealPct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{dealPct}%</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stale Deals Detail */}
      {stats.stale_deal_list?.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Stale Deals — No Contact in 14+ Days
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Deal', 'Manager', 'Stage', 'Value', 'Days Silent', 'Expected Close', 'Date Slips'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.stale_deal_list.map((d: any) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 pr-4">
                    <Link href={`/dashboard/deals/${d.id}`} className="text-blue-600 hover:underline font-medium">{d.title}</Link>
                    <div className="text-xs text-slate-400">{d.company}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{d.assigned_user_name}</td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{d.stage}</span>
                  </td>
                  <td className="py-2.5 pr-4">{d.value ? fmt(d.value) : '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className="text-red-600 font-bold">{d.days_since_contact} days</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {d.expected_close_date ? (
                      <span className={new Date(d.expected_close_date) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                        {new Date(d.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {new Date(d.expected_close_date) < new Date() && ' ⚠'}
                      </span>
                    ) : <span className="text-red-500 font-semibold">Not Set!</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    {d.close_date_change_count > 0 ? (
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-semibold">{d.close_date_change_count}×</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Date Slip Report */}
      {stats.slip_deals?.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" /> Close Date Slippage Report
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Deal', 'Manager', 'Stage', 'Value', 'Times Pushed', 'Current Close Date'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-semibold pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.slip_deals.map((d: any) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 pr-4">
                    <Link href={`/dashboard/deals/${d.id}`} className="text-blue-600 hover:underline font-medium">{d.title}</Link>
                    <div className="text-xs text-slate-400">{d.client_name}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{d.assigned_user_name}</td>
                  <td className="py-2.5 pr-4 text-slate-500 capitalize">{d.stage}</td>
                  <td className="py-2.5 pr-4">{d.value ? fmt(d.value) : '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-bold ${d.close_date_change_count >= 3 ? 'text-red-600' : d.close_date_change_count >= 2 ? 'text-amber-600' : 'text-slate-600'}`}>
                      {d.close_date_change_count}×
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {d.expected_close_date ? (
                      <span className={new Date(d.expected_close_date) < new Date() ? 'text-red-600 font-bold' : 'text-slate-700'}>
                        {new Date(d.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {new Date(d.expected_close_date) < new Date() && ' — OVERDUE!'}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-white rounded-lg p-2.5 text-center">
      <div className={`text-lg font-bold ${color || 'text-slate-800'}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
