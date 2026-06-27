'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Briefcase, CheckSquare,
  MessageSquare, BarChart3, LogOut, TrendingUp, Bell,
} from 'lucide-react';

interface Props {
  user: { name: string; role: string; zone: string | null };
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/deals', label: 'Deals', icon: Briefcase },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
];

const leaderOnlyNav = [
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/targets', label: 'Targets', icon: TrendingUp },
];

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState(0);

  const isLeader = user.role === 'director' || user.role === 'cmd';

  useEffect(() => {
    if (!isLeader) return;
    fetch('/api/alerts?count=1')
      .then(r => r.json())
      .then(d => setAlertCount(d.count ?? 0))
      .catch(() => {});
  }, [isLeader]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const zoneLabel = user.zone === 'south_west' ? 'South & West' : user.zone === 'north' ? 'North' : null;
  const roleLabel =
    user.role === 'cmd'      ? 'CMD & Founder' :
    user.role === 'director' ? 'Director & Partner' :
                               `Manager · ${zoneLabel}`;

  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Sales CRM</div>
            <div className="text-slate-400 text-xs">Internal Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {isLeader && (
          <>
            <div className="pt-3 pb-1 px-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {user.role === 'cmd' ? 'CMD' : 'Director'}
              </span>
            </div>
            {leaderOnlyNav.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-medium truncate">{user.name}</div>
            <div className="text-slate-400 text-xs">{roleLabel}</div>
          </div>
          {isLeader && alertCount > 0 && (
            <div className="relative shrink-0">
              <Bell className="w-4 h-4 text-slate-400" />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            </div>
          )}
        </div>
        <button onClick={logout}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-full px-2 py-1.5 rounded hover:bg-slate-800 transition-colors">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
