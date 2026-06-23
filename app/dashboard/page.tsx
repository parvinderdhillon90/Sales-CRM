'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, AlertTriangle, Flame, Clock, CheckSquare,
  MessageSquare, Users, Briefcase, Calendar, ArrowRight,
} from 'lucide-react';

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', closed_won: 'Won', closed_lost: 'Lost',
};
const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-gray-200', qualified: 'bg-blue-400', proposal: 'bg-purple-400',
  negotiation: 'bg-amber-400', closed_won: 'bg-green-500', closed_lost: 'bg-red-400',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
    ]).then(([u, s]) => { setUser(u); setStats(s); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.name} 👋</h1>
        <p className="text-slate-500 text-sm mt-0.5">{today}</p>
      </div>

      {/* Alert banner for critical issues */}
      {(stats.stale_deals > 0 || stats.overdue_tasks > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Action Required</p>
            <div className="text-red-700 text-sm mt-0.5 flex flex-wrap gap-x-4">
              {stats.stale_deals > 0 && <span>{stats.stale_deals} deal{stats.stale_deals > 1 ? 's' : ''} with no contact in 14+ days</span>}
              {stats.overdue_tasks > 0 && <span>{stats.overdue_tasks} task{stats.overdue_tasks > 1 ? 's' : ''} overdue</span>}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<TrendingUp className="w-5 h-5 text-blue-600" />} bg="bg-blue-50"
          label="Pipeline Value" value={fmt(stats.pipeline_value)} sub={`${stats.total_deals} active deals`} />
        <StatCard icon={<Flame className="w-5 h-5 text-red-500" />} bg="bg-red-50"
          label="Hot Deals" value={stats.hot_deals} sub="Prioritize these" />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} bg="bg-amber-50"
          label="Stale Deals" value={stats.stale_deals} sub="No contact 14+ days" urgent={stats.stale_deals > 0} />
        <StatCard icon={<CheckSquare className="w-5 h-5 text-green-600" />} bg="bg-green-50"
          label="Won This Month" value={stats.closed_won_month}
          sub={stats.closed_won_value_month > 0 ? fmt(stats.closed_won_value_month) : 'Keep pushing!'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Director: Zone Performance */}
          {user?.role === 'director' && stats.zone_stats?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" /> Zone Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Manager', 'Zone', 'Active', 'Hot', 'Stale', 'Pipeline', 'Won (Month)', 'Avg Days', 'Date Slips'].map(h => (
                        <th key={h} className="text-left text-xs text-slate-500 font-medium pb-2 pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.zone_stats.map((z: any) => (
                      <tr key={z.zone} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 pr-3 font-medium text-slate-800">{z.manager_name}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{z.zone === 'south_west' ? 'South & West' : 'North'}</td>
                        <td className="py-2.5 pr-3">{z.total_deals}</td>
                        <td className="py-2.5 pr-3">
                          {z.hot_deals > 0 ? <span className="text-red-600 font-semibold">{z.hot_deals}</span> : <span className="text-slate-400">0</span>}
                        </td>
                        <td className="py-2.5 pr-3">
                          {z.stale_deals > 0 ? (
                            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-semibold">{z.stale_deals}</span>
                          ) : <span className="text-green-600 font-medium">0 ✓</span>}
                        </td>
                        <td className="py-2.5 pr-3 font-medium">{fmt(z.pipeline_value)}</td>
                        <td className="py-2.5 pr-3">{z.closed_won_month > 0 ? <span className="text-green-600 font-semibold">{z.closed_won_month}</span> : '0'}</td>
                        <td className="py-2.5 pr-3">
                          <span className={z.avg_days_since_contact > 10 ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                            {Math.round(z.avg_days_since_contact)}d
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          {z.date_slips_total > 0 ? (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs">{z.date_slips_total}</span>
                          ) : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stage breakdown */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-500" /> Pipeline by Stage
            </h2>
            <div className="space-y-2">
              {Object.entries(STAGE_LABELS).filter(([s]) => !['closed_won', 'closed_lost'].includes(s)).map(([stage, label]) => {
                const count = stats.stage_breakdown?.[stage] || 0;
                const max = Math.max(...Object.values(stats.stage_breakdown || {}).map(Number), 1);
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-24 shrink-0">{label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${STAGE_COLORS[stage]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium text-slate-700 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stale deals */}
          {stats.stale_deal_list?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Stale Deals — Needs Contact
                </h2>
                <Link href="/dashboard/deals?stale=1" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {stats.stale_deal_list.slice(0, 5).map((d: any) => (
                  <Link key={d.id} href={`/dashboard/deals/${d.id}`}
                    className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-100">
                    <div>
                      <div className="font-medium text-sm text-slate-800">{d.title}</div>
                      <div className="text-xs text-slate-500">{d.client_company} · {d.assigned_user_name}</div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-bold text-red-600">{d.days_since_contact}d ago</div>
                      <div className="text-xs text-slate-400">{d.value ? fmt(d.value) : 'No value'}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Date slip report (director) */}
          {user?.role === 'director' && stats.slip_deals?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" /> Closing Date Slippage
                <span className="text-xs font-normal text-slate-400 ml-1">— deals where close date has been pushed</span>
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Deal', 'Assigned To', 'Date Pushed', 'Expected Close', 'Value'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-500 font-medium pb-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.slip_deals.slice(0, 6).map((d: any) => (
                    <tr key={d.id} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <Link href={`/dashboard/deals/${d.id}`} className="text-blue-600 hover:underline font-medium">{d.title}</Link>
                        <div className="text-xs text-slate-400">{d.client_name}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{d.assigned_user_name}</td>
                      <td className="py-2 pr-3">
                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-semibold">
                          {d.close_date_change_count}x
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {d.expected_close_date ? (
                          <span className={new Date(d.expected_close_date) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                            {new Date(d.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {new Date(d.expected_close_date) < new Date() && ' ⚠ OVERDUE'}
                          </span>
                        ) : <span className="text-red-500">Not set!</span>}
                      </td>
                      <td className="py-2 pr-3">{d.value ? fmt(d.value) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-slate-700 text-sm">Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Total Clients</span>
                <span className="font-semibold">{stats.total_clients}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Closing in 7 days</span>
                <span className={`font-semibold ${stats.deals_closing_soon > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                  {stats.deals_closing_soon}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Pending Tasks</span>
                <span className="font-semibold">{stats.pending_tasks}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Overdue Tasks</span>
                <span className={`font-semibold ${stats.overdue_tasks > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.overdue_tasks}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Unread Messages</span>
                <span className={`font-semibold ${stats.unread_messages > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                  {stats.unread_messages}
                </span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { href: '/dashboard/deals', label: 'View Pipeline', icon: Briefcase },
                { href: '/dashboard/tasks', label: 'My Tasks', icon: CheckSquare },
                { href: '/dashboard/messages', label: `Messages${stats.unread_messages > 0 ? ` (${stats.unread_messages})` : ''}`, icon: MessageSquare },
                { href: '/dashboard/clients', label: 'Clients', icon: Users },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors">
                  <Icon className="w-4 h-4" />{label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, label, value, sub, urgent }: {
  icon: React.ReactNode; bg: string; label: string; value: string | number; sub: string; urgent?: boolean;
}) {
  return (
    <div className={`card p-4 ${urgent ? 'border-red-200 bg-red-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${urgent ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
      <div className="text-xs font-medium text-slate-600 mt-0.5">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
