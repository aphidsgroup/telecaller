import Link from 'next/link';
import prisma from '@/lib/prisma';
import { StatCard, SectionTitle } from '@/components/admin/Ui';
import { EVENT_LABEL, LEAD_STATUS, ROLE } from '@/lib/constants';
import { formatDateTime, formatDuration, relativeTime } from '@/lib/format';
import { getSettings, str } from '@/lib/settings';
import { todayRangeUtc } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Overview - Buildogram Admin' };

export default async function AdminOverview() {
  const settings = await getSettings();
  const tz = str(settings, 'company.timezone');
  const { start, end } = await todayRangeUtc(settings);
  const now = new Date();

  const [
    totalLeads,
    unassigned,
    inProgress,
    dueNow,
    closedToday,
    convertedTotal,
    callsToday,
    flagged,
    avgToday,
    telecallers,
    recentEvents,
    lastImport,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: LEAD_STATUS.UNASSIGNED } }),
    prisma.lead.count({ where: { status: LEAD_STATUS.IN_PROGRESS } }),
    prisma.lead.count({ where: { status: LEAD_STATUS.SCHEDULED, followUpAt: { lte: now } } }),
    prisma.disposition.count({ where: { submittedAt: { gte: start, lt: end } } }),
    prisma.lead.count({ where: { lastLeadStatus: 'CONVERTED' } }),
    prisma.leadEvent.count({ where: { type: 'CALL_CLICKED', at: { gte: start, lt: end } } }),
    prisma.lead.count({ where: { flaggedForReview: true } }),
    prisma.disposition.aggregate({
      where: { submittedAt: { gte: start, lt: end }, responseSeconds: { not: null } },
      _avg: { responseSeconds: true },
    }),
    prisma.user.findMany({
      where: { role: ROLE.TELECALLER },
      select: { id: true, name: true, isActive: true, lastSeenAt: true, dailyTarget: true },
      orderBy: { name: 'asc' },
    }),
    prisma.leadEvent.findMany({
      orderBy: { at: 'desc' },
      take: 18,
      include: { user: { select: { name: true } }, lead: { select: { id: true, name: true } } },
    }),
    prisma.importLog.findFirst({ orderBy: { startedAt: 'desc' } }),
  ]);

  const perCaller = await Promise.all(
    telecallers.map(async (t) => {
      const [done, queue, holding] = await Promise.all([
        prisma.disposition.count({ where: { userId: t.id, submittedAt: { gte: start, lt: end } } }),
        prisma.lead.count({
          where: {
            assignedToId: t.id,
            status: { in: [LEAD_STATUS.ASSIGNED, LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS, LEAD_STATUS.SCHEDULED] },
          },
        }),
        prisma.lead.findFirst({
          where: { assignedToId: t.id, status: { in: [LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS] } },
          select: { id: true, name: true, status: true, inProgressAt: true, servedAt: true },
        }),
      ]);
      const online = t.lastSeenAt && now.getTime() - new Date(t.lastSeenAt).getTime() < 5 * 60000;
      return { ...t, done, queue, holding, online };
    })
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total leads" value={totalLeads} hint={`${unassigned} still unassigned`} href="/admin/leads" />
        <StatCard label="Dispositions today" value={closedToday} hint={`${callsToday} call buttons pressed`} />
        <StatCard
          label="Due follow-ups"
          value={dueNow}
          tone={dueNow > 0 ? 'warn' : 'default'}
          hint="Waiting in telecaller queues right now"
          href="/admin/leads?status=SCHEDULED"
        />
        <StatCard
          label="Needs review"
          value={flagged}
          tone={flagged > 0 ? 'bad' : 'good'}
          hint={`${inProgress} lead(s) mid-call`}
          href="/admin/leads?flagged=1"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle action={<Link href="/admin/telecallers" className="text-xs font-semibold text-brand-600">Manage</Link>}>
            Telecaller activity today
          </SectionTitle>
          <div className="card divide-y divide-slate-100">
            {perCaller.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No telecallers yet.</p>
            ) : (
              perCaller.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${t.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <Link href={`/admin/telecallers/${t.id}`} className="truncate text-sm font-semibold text-slate-900 hover:underline">
                        {t.name}
                      </Link>
                      {!t.isActive ? <span className="chip bg-slate-100 text-slate-500">Inactive</span> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {t.holding
                        ? `Working ${t.holding.name} (${t.holding.status === 'IN_PROGRESS' ? 'call clicked' : 'on screen'})`
                        : t.lastSeenAt
                          ? `Last seen ${relativeTime(t.lastSeenAt)}`
                          : 'Never signed in'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.done}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">worked</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.queue}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">in queue</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard
              label="Avg. call-click to status"
              value={avgToday._avg.responseSeconds ? formatDuration(avgToday._avg.responseSeconds) : '-'}
              hint="Today, across all telecallers"
            />
            <StatCard label="Converted / booked" value={convertedTotal} tone="good" hint="All time" href="/admin/reports" />
          </div>
        </section>

        <section>
          <SectionTitle
            action={<Link href="/admin/imports" className="text-xs font-semibold text-brand-600">Sync log</Link>}
          >
            Latest sheet sync
          </SectionTitle>
          <div className="card p-4">
            {lastImport ? (
              <>
                <p className="text-sm font-semibold text-slate-900">{lastImport.message || lastImport.status}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {lastImport.source.replace(/_/g, ' ')} - {formatDateTime(lastImport.startedAt, tz)}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <dt className="text-[11px] uppercase text-slate-400">New</dt>
                    <dd className="text-sm font-bold text-slate-900">{lastImport.inserted}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <dt className="text-[11px] uppercase text-slate-400">Dupes</dt>
                    <dd className="text-sm font-bold text-slate-900">{lastImport.duplicates}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <dt className="text-[11px] uppercase text-slate-400">Invalid</dt>
                    <dd className="text-sm font-bold text-slate-900">{lastImport.invalid}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                No sync has run yet. Configure the sheet in <Link className="text-brand-600 underline" href="/admin/settings">Settings</Link>.
              </p>
            )}
          </div>

          <SectionTitle>Live activity</SectionTitle>
          <div className="card max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">Nothing has happened yet.</p>
            ) : (
              recentEvents.map((e) => (
                <div key={e.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{EVENT_LABEL[e.type] || e.type}</p>
                    <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(e.at)}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    <Link href={`/admin/leads/${e.lead.id}`} className="text-brand-600 hover:underline">
                      {e.lead.name}
                    </Link>
                    {e.user ? ` - ${e.user.name}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
