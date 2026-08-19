import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ROLE } from '@/lib/constants';
import SignOutButton from '@/components/admin/SignOutButton';
import NotificationBell from '@/components/admin/NotificationBell';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/telecallers', label: 'Telecallers' },
  { href: '/admin/imports', label: 'Sheet sync' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/settings', label: 'Settings' },
];

export default async function AdminLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== ROLE.ADMIN) redirect('/caller');

  const flagged = await prisma.lead.count({ where: { flaggedForReview: true } });

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
              B
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">Buildogram Telecalling</p>
              <p className="text-xs text-slate-500">Admin dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {flagged > 0 ? (
              <Link href="/admin/leads?flagged=1" className="chip bg-rose-100 text-rose-700">
                {flagged} need review
              </Link>
            ) : null}
            <NotificationBell />
            <span className="hidden text-sm text-slate-600 sm:block">{user.name}</span>
            <SignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
