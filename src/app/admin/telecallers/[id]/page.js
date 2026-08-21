import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { StatCard, SectionTitle } from '@/components/admin/Ui';
import { LEAD_STATUS, callCategoryLabel, leadStatusCategoryLabel } from '@/lib/constants';
import { formatDateTime, formatDuration, relativeTime } from '@/lib/format';
import { getSettings, str } from '@/lib/settings';
import { todayRangeUtc } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export default async function TelecallerDetail({ params }) {
  const { id } = await params;
  const settings = await getSettings();
  const tz = str(settings, 'company.timezone');
  const { start, end } = await todayRangeUtc(settings);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, isActive: true, dailyTarget: true, lastLoginAt: true, lastSeenAt: true },
  });
  if (!user) notFound();

  const [today, week, avg, breakdown, queue, holding, sessions, recent] = await Promise.all([
    prisma.disposition.count({ where: { userId: id, submittedAt: { gte: start, lt: end } } }),
    prisma.disposition.count({ where: { userId: id, submittedAt: { gte: weekAgo } } }),
    prisma.disposition.aggregate({
      where: { userId: id, submittedAt: { gte: weekAgo }, responseSeconds: { not: null } },
      _avg: { responseSeconds: true },
      _max: { responseSeconds: true },
    }),
    prisma.disposition.groupBy({
      by: ['leadStatus'],
      where: { userId: id, submittedAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
    prisma.lead.count({
      where: {
        assignedToId: id,
        status: { in: [LEAD_STATUS.ASSIGNED, LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS, LEAD_STATUS.SCHEDULED] },
      },
    }),
    prisma.lead.findFirst({
      where: { assignedToId: id, status: { in: [LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS] } },
      select: { id: true, name: true, status: true, servedAt: true, inProgressAt: true },
    }),
    prisma.loginSession.findMany({ where: { userId: id }, orderBy: { loginAt: 'desc' }, take: 100 }),
    prisma.disposition.findMany({
      where: { userId: id },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      include: { lead: { select: { id: true, name: true, project: true } } },
    }),
  ]);

  const totalWeek = breakdown.reduce((acc, b) => acc + b._count._all, 0) || 1;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/telecallers" className="text-xs font-semibold text-brand-600">
          &larr; All telecallers
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{user.name}</h1>
        <p className="text-sm text-slate-500">
          {user.email} - last active {user.lastSeenAt ? relativeTime(user.lastSeenAt) : 'never'}
          {user.isActive ? '' : ' - account deactivated'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Worked today" value={today} hint={`Target ${user.dailyTarget}`} />
        <StatCard label="Worked (7 days)" value={week} />
        <StatCard
          label="Avg. click to log"
          value={avg._avg.responseSeconds ? formatDuration(avg._avg.responseSeconds) : '-'}
          hint={avg._max.responseSeconds ? `Slowest ${formatDuration(avg._max.responseSeconds)}` : null}
        />
        <StatCard label="Open queue" value={queue} />
        <StatCard
          label="Right now"
          value={holding ? (holding.status === 'IN_PROGRESS' ? 'On a call' : 'Reading lead') : 'Idle'}
          tone={holding ? 'warn' : 'default'}
          hint={holding ? holding.name : 'No lead on screen'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle>Detailed Call Timeline (Last 100)</SectionTitle>
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Lead</th>
                  <th className="th">Call category</th>
                  <th className="th">Lead status</th>
                  <th className="th">Gap (Idle)</th>
                  <th className="th">Call Clicked At</th>
                  <th className="th">Time Spent</th>
                  <th className="th">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((d, i) => {
                  const prev = recent[i + 1];
                  const clickedAt = d.responseSeconds != null 
                    ? new Date(d.submittedAt.getTime() - d.responseSeconds * 1000) 
                    : null;
                    
                  let gapSeconds = null;
                  if (prev && clickedAt) {
                    gapSeconds = Math.max(0, (clickedAt.getTime() - prev.submittedAt.getTime()) / 1000);
                  }

                  return (
                    <tr key={d.id}>
                      <td className="td">
                        <Link href={`/admin/leads/${d.lead.id}`} className="font-medium text-brand-700 hover:underline">
                          {d.lead.name}
                        </Link>
                        <div className="text-xs text-slate-500">{d.lead.project || '-'}</div>
                      </td>
                      <td className="td text-xs">{callCategoryLabel(d.callCategory)}</td>
                      <td className="td text-xs">{leadStatusCategoryLabel(d.leadStatus)}</td>
                      <td className="td text-xs font-semibold text-slate-400">
                        {gapSeconds != null ? (
                          gapSeconds > 300 ? <span className="text-rose-500">{formatDuration(gapSeconds)}</span> : formatDuration(gapSeconds)
                        ) : '-'}
                      </td>
                      <td className="td text-xs text-slate-500">
                        {clickedAt ? formatDateTime(clickedAt, tz) : '-'}
                      </td>
                      <td className="td text-xs font-semibold text-slate-700">
                        {d.responseSeconds != null ? formatDuration(d.responseSeconds) : '-'}
                      </td>
                      <td className="td text-xs text-slate-500">{formatDateTime(d.submittedAt, tz)}</td>
                    </tr>
                  );
                })}
                {recent.length === 0 ? (
                  <tr>
                    <td className="td text-slate-500" colSpan={7}>
                      Nothing logged yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-5">
          <section>
            <SectionTitle>Disposition mix (7 days)</SectionTitle>
            <div className="card space-y-2 p-4">
              {breakdown.length === 0 ? (
                <p className="text-sm text-slate-500">No data yet.</p>
              ) : (
                breakdown
                  .sort((a, b) => b._count._all - a._count._all)
                  .map((b) => (
                    <div key={b.leadStatus}>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>{leadStatusCategoryLabel(b.leadStatus)}</span>
                        <span className="font-semibold">{b._count._all}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.round((b._count._all / totalWeek) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section>
            <SectionTitle>Login sessions</SectionTitle>
            <div className="card divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Never signed in.</p>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="px-4 py-2.5 text-xs">
                    <p className="font-semibold text-slate-800">{formatDateTime(s.loginAt, tz)}</p>
                    <p className="text-slate-500">
                      Active until {formatDateTime(s.lastSeenAt, tz)}
                      {s.logoutAt ? ' - signed out' : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
