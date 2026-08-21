import prisma from '@/lib/prisma';
import { Bar, SectionTitle } from '@/components/admin/Ui';
import TelecallerAdmin from '@/components/admin/TelecallerAdmin';
import { ROLE } from '@/lib/constants';
import { relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Site Engineers - Buildogram Admin' };

export default async function EngineersPage() {
  const users = await prisma.user.findMany({
    where: { role: ROLE.SITE_ENGINEER },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true, phone: true, isActive: true,
      lastLoginAt: true, lastSeenAt: true, role: true,
      company: { select: { name: true } }
    },
  });

  return (
    <div className="space-y-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Site Engineers</h1>
        <p className="text-sm text-slate-500">Add, edit, and deactivate Site Engineer accounts.</p>
      </header>

      <TelecallerAdmin targetRole="SITE_ENGINEER" />

      <section>
        <SectionTitle>Current Engineers</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Phone</th>
                <th className="th">Company</th>
                <th className="th text-right">Status</th>
                <th className="th">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium text-slate-900">{r.name}</td>
                  <td className="td text-slate-500">{r.email}</td>
                  <td className="td text-slate-500">{r.phone || '-'}</td>
                  <td className="td text-slate-500">{r.company?.name || 'All'}</td>
                  <td className="td text-right">
                    <span className={`badge ${r.isActive ? 'badge-green' : 'badge-slate'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td text-xs text-slate-500">
                    {r.lastSeenAt ? relativeTime(r.lastSeenAt) : 'Never'}
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className="td text-slate-500" colSpan={6}>
                    No engineers yet - add one above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
