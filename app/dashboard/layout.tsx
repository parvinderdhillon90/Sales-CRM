import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={{ name: session.name, role: session.role, zone: session.zone }} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
