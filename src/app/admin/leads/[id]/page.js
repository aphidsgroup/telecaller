import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { StatusChip } from '@/components/admin/Ui';
import LeadAdminPanel from '@/components/admin/LeadAdminPanel';
import { EVENT_LABEL, ROLE, callCategoryLabel, leadStatusCategoryLabel } from '@/lib/constants';
import { parseMeta } from '@/lib/events';
import { displayPhone, formatDateTime, formatDuration, relativeTime, waHref } from '@/lib/format';
import { getSettings, str } from '@/lib/settings';
import { scoreBand } from '@/lib/score';

export const dynamic = 'force-dynamic';

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800">{value || '-'}</dd>
    </div>
  );
}

export default async function LeadDetailPage({ params }) {
  const { id } = await params;
  const settings = await getSettings();
  const tz = str(settings, 'company.timezone');

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      importLog: true,
      events: { orderBy: { at: 'desc' }, include: { user: { select: { name: true } } } },
      dispositions: { orderBy: { submittedAt: 'desc' }, include: { user: { select: { name: true } } } },
      duplicates: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!lead) notFound();

  const telecallers = await prisma.user.findMany({
    where: { role: ROLE.TELECALLER },
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/leads" className="text-xs font-semibold text-brand-600">
            &larr; Back to leads
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{lead.name}</h1>
          <p className="font-mono text-sm text-slate-600">{displayPhone(lead.phone)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={lead.status} />
          <span className="chip bg-slate-100 text-slate-600">{scoreBand(lead.score)} - score {lead.score}</span>
          {lead.isDnd ? <span className="chip bg-rose-100 text-rose-700">DND</span> : null}
          {lead.flaggedForReview ? <span className="chip bg-amber-100 text-amber-800">Needs review</span> : null}
          <a className="btn-ghost" href={waHref(lead.phone, '')} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
      </div>

      {lead.flaggedForReview && lead.flagReason ? (
        <div className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{lead.flagReason}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Lead details</h2>
            <dl className="divide-y divide-slate-100">
              <Row label="Project / site" value={lead.project} />
              <Row label="City / area" value={lead.city} />
              <Row label="Budget" value={lead.budget} />
              <Row label="Source" value={lead.source} />
              <Row label="Alternate phone" value={lead.altPhone ? displayPhone(lead.altPhone) : null} />
              <Row label="Assigned to" value={lead.assignedTo?.name || 'Unassigned pool'} />
              <Row label="Attempts" value={lead.attemptCount} />
              <Row label="Sheet row" value={lead.sourceRow} />
              <Row label="Date added (sheet)" value={lead.dateAdded ? formatDateTime(lead.dateAdded, tz) : null} />
            </dl>
            {lead.notes ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{lead.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Key timestamps</h2>
            <dl className="divide-y divide-slate-100">
              <Row label="Uploaded" value={formatDateTime(lead.createdAt, tz)} />
              <Row label="Assigned" value={lead.assignedAt ? formatDateTime(lead.assignedAt, tz) : null} />
              <Row label="First shown" value={lead.servedAt ? formatDateTime(lead.servedAt, tz) : null} />
              <Row label="Last call click" value={lead.callClickedAt ? formatDateTime(lead.callClickedAt, tz) : null} />
              <Row label="Last status update" value={lead.lastContactedAt ? formatDateTime(lead.lastContactedAt, tz) : null} />
              <Row label="Next follow-up" value={lead.followUpAt ? formatDateTime(lead.followUpAt, tz) : null} />
              <Row label="Closed" value={lead.closedAt ? formatDateTime(lead.closedAt, tz) : null} />
            </dl>
          </section>

          {lead.duplicates.length ? (
            <section className="card p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Duplicate uploads ({lead.duplicates.length})
              </h2>
              <ul className="space-y-2 text-sm text-slate-600">
                {lead.duplicates.map((d) => (
                  <li key={d.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    {d.name || 'Unnamed'} - {formatDateTime(d.createdAt, tz)}
                    <span className="ml-2 chip bg-slate-200 text-slate-600">{d.resolution}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <LeadAdminPanel lead={JSON.parse(JSON.stringify(lead))} telecallers={telecallers} />

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Status history ({lead.dispositions.length}) - append only
            </h2>
            {lead.dispositions.length === 0 ? (
              <p className="text-sm text-slate-500">No status update has been logged yet.</p>
            ) : (
              <ol className="space-y-3">
                {lead.dispositions.map((d) => (
                  <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        Attempt #{d.attemptNo} - {leadStatusCategoryLabel(d.leadStatus)}
                      </p>
                      <span className="text-xs text-slate-500">{formatDateTime(d.submittedAt, tz)}</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {callCategoryLabel(d.callCategory)} - logged by {d.user?.name || 'system'}
                      {d.isOverride ? ' (admin override)' : ''}
                      {d.queuedOffline ? ' - synced from offline queue' : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      {d.callClickedAt ? <span>Call clicked {formatDateTime(d.callClickedAt, tz)}</span> : null}
                      {d.responseSeconds != null ? <span>Logged after {formatDuration(d.responseSeconds)}</span> : null}
                      {d.followUpAt ? <span>Follow-up {formatDateTime(d.followUpAt, tz)}</span> : null}
                    </div>
                    {d.notes ? <p className="mt-2 whitespace-pre-wrap text-sm italic text-slate-700">{d.notes}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Full timeline ({lead.events.length} events)
            </h2>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {lead.events.map((e) => {
                const meta = parseMeta(e);
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{EVENT_LABEL[e.type] || e.type}</p>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(e.at, tz)} ({relativeTime(e.at)})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {e.user?.name ? `by ${e.user.name}` : 'system'}
                      {meta?.reason ? ` - ${meta.reason}` : ''}
                      {meta?.leadStatusLabel ? ` - ${meta.leadStatusLabel}` : ''}
                      {meta?.callCategoryLabel ? ` / ${meta.callCategoryLabel}` : ''}
                      {meta?.responseSeconds != null ? ` - logged in ${formatDuration(meta.responseSeconds)}` : ''}
                      {meta?.queuedOffline ? ' - offline sync' : ''}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
