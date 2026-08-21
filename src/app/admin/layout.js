import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';
import SignOutButton from '@/components/admin/SignOutButton';
import NotificationBell from '@/components/admin/NotificationBell';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import {
  LayoutDashboard, Users, UsersRound, FileDown, Settings, Building, AlertTriangle, FileText, CloudUpload, BarChart3, Clock
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/companies', label: 'Companies', icon: Building },
  { href: '/admin/followups', label: 'Follow-ups', icon: Clock },
  { href: '/admin/leads', label: 'Leads', icon: FileText },
  { href: '/admin/telecallers', label: 'Telecallers', icon: Users },
  { href: '/admin/managers', label: 'Managers', icon: UsersRound },
  { href: '/admin/engineers', label: 'Site Engineers', icon: UsersRound },
  { href: '/admin/imports', label: 'Sheet Sync', icon: CloudUpload },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default async function AdminLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== ROLE.ADMIN) redirect('/caller');

  const flagged = await prisma.lead.count({ where: { flaggedForReview: true } });

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || headersList.get('referer') || '';

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 h-14">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 p-1.5">
              <img src="/icon.png" alt="Buildogram" className="h-full w-full object-contain" />
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none">Telecalling</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none mt-0.5">Admin</p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {flagged > 0 ? (
              <Link
                href="/admin/leads?flagged=1"
                className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <AlertTriangle className="h-3 w-3" />
                {flagged} flagged
              </Link>
            ) : null}
            <NotificationBell />
            <span className="hidden text-sm font-medium text-slate-600 sm:block">{user.name}</span>
            <SignOutButton />
          </div>
        </div>

        {/* Nav strip */}
        <nav className="mx-auto flex max-w-7xl gap-0.5 overflow-x-auto px-2 pb-2 scrollbar-none">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link whitespace-nowrap flex-shrink-0"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
