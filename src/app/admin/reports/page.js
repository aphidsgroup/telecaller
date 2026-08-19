import prisma from '@/lib/prisma';
import { Bar, SectionTitle, StatCard } from '@/components/admin/Ui';
import ExportPanel from '@/components/admin/ExportPanel';
import { ROLE, callCategoryLabel, leadStatusCategoryLabel } from '@/lib/constants';
import { formatDuration } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Reports - Buildogram Admin' };

function dateRange(params) {
  const from = params.from ? new Date(`${params.from}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86400000);
  const to = params.to ? new Date(`${params.to}T23:59:59.999Z`) : new Date();
  return { from, to };
}

export default async function ReportsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const { from, to } = dateRange(params);
  await getSettings();

  const leadWhere = { createdAt: { gte: from, lte: to } };

  const [
    totalLeads,
    contacted,
    siteVisits,
    converted,
    notInterested,
    wrongNumber,
    bySource,
    byProject,
    dispositionMix,
    callMix,
    telecallers,
  ] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, lastContactedAt: { not: null } } }),
    prisma.lead.count({ where: { ...leadWhere, lastLeadStatus: 'SEND_SITE_VISIT' } }),
    prisma.lead.count({ where: { ...leadWhere, lastLeadStatus: 'CONVERTED' } }),
    prisma.lead.count({ where: { ...leadWhere, lastLeadStatus: 'NOT_INTERESTED' } }),
    prisma.lead.count({ where: { ...leadWhere, lastLeadStatus: 'WRONG_NUMBER' } }),
    prisma.lead.groupBy({ by: ['source'], where: leadWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['project'], where: leadWhere, _count: { _all: true } }),
    prisma.disposition.groupBy({
      by: ['leadStatus'],
      where: { submittedAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.disposition.groupBy({
      by: ['callCategory'],
      where: { submittedAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.user.findMany({ where: { role: ROLE.TELECALLER }, select: { id: true, name: true, dailyTarget: true } }),
  ]);

  const leaderboard = await Promise.all(
    telecallers.map(async (t) => {
      const [worked, calls, conv, visits, avg, idleSince] = await Promise.all([
        prisma.disposition.count({ where: { userId: t.id, submittedAt: { gte: from, lte: to } } }),
        prisma.leadEvent.count({ where: { userId: t.id, type: 'CALL_CLICKED', at: { gte: from, lte: to } } }),
        prisma.disposition.count({ where: { userId: t.id, leadStatus: 'CONVERTED', submittedAt: { gte: from, lte: to } } }),
        prisma.disposition.count({ where: { userId: t.id, leadStatus: 'SEND_SITE_VISIT', submittedAt: { gte: from, lte: to } } }),
        prisma.disposition.aggregate({
          where: { userId: t.id, submittedAt: { gte: from, lte: to }, responseSeconds: { not: null } },
          _avg: { responseSeconds: true },
        }),
        prisma.disposition.findFirst({
          where: { userId: t.id },
          orderBy: { submittedAt: 'desc' },
          select: { submittedAt: true },
        }),
      ]);
      return {
        ...t,
        worked,
        calls,
        conv,
        visits,
        avgSeconds: avg._avg.responseSeconds ? Math.round(avg._avg.responseSeconds) : null,
        idleMinutes: idleSince ? Math.round((Date.now() - new Date(idleSince.submittedAt).getTime()) / 60000) : null,
        conversion: worked ? Math.round((conv / worked) * 1000) / 10 : 0,
      };
    })
  );
  leaderboard.sort((a, b) => b.worked - a.worked);

  const funnel = [
    { label: 'Leads uploaded', value: totalLeads },
    { label: 'Contacted (status logged)', value: contacted },
    { label: 'Site visits arranged', value: siteVisits },
    { label: 'Converted / booked', value: converted },
  ];
  const maxWorked = Math.max(1, ...leaderboard.map((l) => l.worked));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            {from.toISOString().slice(0, 10)} to {to.toISOString().slice(0, 10)} - by upload date for leads, by submit
            date for activity.
          </p>
        </div>
        <ExportPanel params={params} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Leads in range" value={totalLeads} />
        <StatCard
          label="Contact rate"
          value={totalLeads ? `${Math.round((contacted / totalLeads) * 100)}%` : '-'}
          hint={`${contacted} contacted`}
        />
        <StatCard
          label="Conversion rate"
          value={totalLeads ? `${Math.round((converted / totalLeads) * 1000) / 10}%` : '-'}
          tone="good"
          hint={`${converted} booked`}
        />
        <StatCard label="Dead leads" value={notInterested + wrongNumber} tone="warn" hint={`${wrongNumber} wrong numbers`} />
      </div>

      <section>
        <SectionTitle>Conversion funnel</SectionTitle>
        <div className="card space-y-3 p-4">
          {funnel.map((step, i) => (
            <div key={step.label}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">{step.label}</span>
                <span className="font-semibold text-slate-900">
                  {step.value}
                  {i > 0 && funnel[0].value ? (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {Math.round((step.value / funnel[0].value) * 100)}% of uploaded
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1">
                <Bar value={step.value} max={funnel[0].value || 1} tone={i === 3 ? 'bg-emerald-500' : 'bg-brand-500'} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Telecaller leaderboard</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">#</th>
                <th className="th">Telecaller</th>
                <th className="th">Leads worked</th>
                <th className="th">Calls attempted</th>
                <th className="th">Site visits</th>
                <th className="th">Converted</th>
                <th className="th">Conversion</th>
                <th className="th">Avg. click to log</th>
                <th className="th">Idle since last log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.map((l, i) => (
                <tr key={l.id}>
                  <td className="td font-semibold text-slate-400">{i + 1}</td>
                  <td className="td font-semibold text-slate-900">{l.name}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className="w-8">{l.worked}</span>
                      <div className="w-24">
                        <Bar value={l.worked} max={maxWorked} />
                      </div>
                    </div>
                  </td>
                  <td className="td">{l.calls}</td>
                  <td className="td">{l.visits}</td>
                  <td className="td font-semibold text-emerald-700">{l.conv}</td>
                  <td className="td">{l.conversion}%</td>
                  <td className="td">{l.avgSeconds != null ? formatDuration(l.avgSeconds) : '-'}</td>
                  <td className="td text-xs text-slate-500">
                    {l.idleMinutes == null ? 'never logged' : `${formatDuration(l.idleMinutes * 60)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionTitle>Leads by source</SectionTitle>
          <BreakdownCard
            rows={bySource.map((s) => ({ label: s.source || 'Unknown', value: s._count._all }))}
          />
        </section>
        <section>
          <SectionTitle>Leads by project / site</SectionTitle>
          <BreakdownCard
            rows={byProject.map((s) => ({ label: s.project || 'Not specified', value: s._count._all }))}
          />
        </section>
        <section>
          <SectionTitle>Lead status mix</SectionTitle>
          <BreakdownCard
            rows={dispositionMix.map((s) => ({ label: leadStatusCategoryLabel(s.leadStatus), value: s._count._all }))}
          />
        </section>
        <section>
          <SectionTitle>Call category mix</SectionTitle>
          <BreakdownCard
            rows={callMix.map((s) => ({ label: callCategoryLabel(s.callCategory), value: s._count._all }))}
          />
        </section>
      </div>
    </div>
  );
}

function BreakdownCard({ rows }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, 12);
  const max = Math.max(1, ...sorted.map((r) => r.value));
  if (!sorted.length) return <div className="card p-6 text-center text-sm text-slate-500">No data in this range.</div>;
  return (
    <div className="card space-y-2 p-4">
      {sorted.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs text-slate-600">
            <span className="truncate pr-2">{r.label}</span>
            <span className="font-semibold text-slate-900">{r.value}</span>
          </div>
          <div className="mt-1">
            <Bar value={r.value} max={max} />
          </div>
        </div>
      ))}
    </div>
  );
}
