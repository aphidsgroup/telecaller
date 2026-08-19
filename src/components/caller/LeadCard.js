'use client';

import { callCategoryLabel, leadStatusCategoryLabel } from '@/lib/constants';
import { displayPhone, formatDateTime, relativeTime } from '@/lib/format';
import { scoreBand } from '@/lib/score';

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export default function LeadCard({ lead, tz }) {
  const band = scoreBand(lead.score || 0);
  const bandClass =
    band === 'Hot' ? 'bg-rose-100 text-rose-700' : band === 'Warm' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';

  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold leading-tight text-slate-900">{lead.name}</h1>
          <p className="font-mono text-sm text-slate-600">{displayPhone(lead.phone)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`chip ${bandClass}`}>{band} lead</span>
          {lead.attemptCount > 0 ? (
            <span className="chip bg-slate-100 text-slate-600">Attempt {lead.attemptCount + 1}</span>
          ) : (
            <span className="chip bg-brand-50 text-brand-700">First attempt</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        <Field label="Project / site" value={lead.project} />
        <Field label="City / area" value={lead.city} />
        <Field label="Budget" value={lead.budget} />
        <Field label="Source" value={lead.source} />
        <Field label="Alternate phone" value={lead.altPhone ? displayPhone(lead.altPhone) : null} />
        <Field label="Added on" value={lead.dateAdded ? formatDateTime(lead.dateAdded, tz) : null} />
      </div>

      {lead.notes ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes from the sheet</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{lead.notes}</p>
        </div>
      ) : null}

      {lead.history?.length ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Previous attempts ({lead.history.length})
          </p>
          <ul className="space-y-2">
            {lead.history.map((h) => (
              <li key={h.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    #{h.attemptNo} {callCategoryLabel(h.callCategory)}
                  </span>
                  <span className="text-[11px] text-slate-500">{relativeTime(h.submittedAt)}</span>
                </div>
                <p className="text-xs text-slate-600">
                  {leadStatusCategoryLabel(h.leadStatus)} - by {h.by}
                  {h.isOverride ? ' (admin)' : ''}
                </p>
                {h.notes ? <p className="mt-1 text-xs italic text-slate-600">{h.notes}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lead.followUpAt ? (
        <div className="border-t border-slate-100 bg-brand-50 px-4 py-2 text-xs font-medium text-brand-800">
          Callback promised for {formatDateTime(lead.followUpAt, tz)}
        </div>
      ) : null}
    </section>
  );
}
