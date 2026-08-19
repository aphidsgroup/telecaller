import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Bar, SectionTitle } from '@/components/admin/Ui';
import TelecallerAdmin from '@/components/admin/TelecallerAdmin';
import { LEAD_STATUS, ROLE } from '@/lib/constants';
import { formatDuration, relativeTime } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { todayRangeUtc } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Telecallers - Buildogram Admin' };

export default async function TelecallersPage() {
  const settings = await getSettings();
  const { start, end } = await todayRangeUtc(settings);
  const now = new Date();

  const users = await prisma.user.findMany({
    where: { role: ROLE.TELECALLER },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true, phone: true, isActive: true, dailyTarget: true,
      lastLoginAt: true, lastSeenAt: true,
    },
  });

  const rows = await Promise.all(
    users.map(async (u) => {
      const [worked, calls, avg, queue, holding, converted] = await Promise.all([
        prisma.disposition.count({ where: { userId: u.id, submittedAt: { gte: start, lt: end } } }),
        prisma.leadEvent.count({ where: { userId: u.id, type: 'CALL_CLICKED', at: { gte: start, lt: end } } }),
        prisma.disposition.aggregate({
          where: { userId: u.id, submittedAt: { gte: start, lt: end }, responseSeconds: { not: null } },
          _avg: { responseSeconds: true },
        }),
        prisma.lead.count({
          where: {
            assignedToId: u.id,
            status: { in: [LEAD_STATUS.ASSIGNED, LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS, LEAD_STATUS.SCHEDULED] },
          },
        }),
        prisma.lead.findFirst({
          where: { assignedToId: u.id, status: { in: [LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS] } },
          select: { id: true, name: true, status: true, inProgressAt: true },
        }),
        prisma.disposition.count({
          where: { userId: u.id, leadStatus: 'CONVERTED', submittedAt: { gte: start, lt: end } },
        }),
      ]);
      return {
        ...u,
        worked,
        calls,
        converted,
        queue,
        holding,
        avgSeconds: avg._avg.responseSeconds ? Math.round(avg._avg.responseSeconds) : null,
        online: u.lastSeenAt && now.getTime() - new Date(u.lastSeenAt).getTime() < 5 * 60000,
      };
    })
  );

  const maxWorked = Math.max(1, ...rows.map((r) => r.worked));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Telecallers</h1>
        <p className="text-sm text-slate-500">
          Productivity for today, plus who is signed in right now. Per-user logins are what make every timestamp
          attributable.
        </p>
      </div>

      <TelecallerAdmin />

      <section>
        <SectionTitle>Today</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Telecaller</th>
                <th className="th">Leads worked</th>
                <th className="th">Calls attempted</th>
                <th className="th">Avg. click to log</th>
                <th className="th">Converted</th>
                <th className="th">Open queue</th>
                <th className="th">Currently</th>
                <th className="th">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${r.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <Link href={`/admin/telecallers/${r.id}`} className="font-semibold text-slate-900 hover:underline">
                        {r.name}
                      </Link>
                      {!r.isActive ? <span className="chip bg-slate-100 text-slate-500">Inactive</span> : null}
                    </div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className="w-8 font-semibold text-slate-900">{r.worked}</span>
                      <div className="w-24">
                        <Bar value={r.worked} max={maxWorked} />
                      </div>
                      <span className="text-xs text-slate-400">/ {r.dailyTarget}</span>
                    </div>
                  </td>
                  <td className="td">{r.calls}</td>
                  <td className="td">{r.avgSeconds != null ? formatDuration(r.avgSeconds) : '-'}</td>
                  <td className="td">{r.converted}</td>
                  <td className="td">{r.queue}</td>
                  <td className="td text-xs">
                    {r.holding ? (
                      <Link href={`/admin/leads/${r.holding.id}`} className="text-brand-600 hover:underline">
                        {r.holding.name}
                        <span className="ml-1 text-slate-400">
                          ({r.holding.status === 'IN_PROGRESS' ? 'call clicked' : 'on screen'})
                        </span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">Idle</span>
                    )}
                  </td>
                  <td className="td text-xs text-slate-500">
                    {r.lastSeenAt ? relativeTime(r.lastSeenAt) : 'Never'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="td text-slate-500" colSpan={8}>
                    No telecallers yet - add one above.
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
