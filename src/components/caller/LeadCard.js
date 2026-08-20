'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, MapPin, Wallet, Globe, Phone, Calendar } from 'lucide-react';
import { callCategoryLabel, leadStatusCategoryLabel } from '@/lib/constants';
import { displayPhone, formatDateTime, relativeTime } from '@/lib/format';
import { scoreBand } from '@/lib/score';

function Field({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export default function LeadCard({ lead, tz }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const band = scoreBand(lead.score || 0);

  const bandBorder = band === 'Hot' ? 'border-rose-500' : band === 'Warm' ? 'border-amber-400' : 'border-slate-300';
  const bandChip = band === 'Hot' ? 'badge-hot' : band === 'Warm' ? 'badge-warm' : 'badge-cold';

  const isPost = lead.isPostSiteVisit;
  const bg = isPost ? 'bg-amber-50/60 shadow-amber-100/50' : 'bg-white';

  return (
    <section className={`card overflow-hidden border-l-4 ${bandBorder} ${bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <h1 className="text-xl font-black leading-tight tracking-tight text-slate-900">{lead.name}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="font-mono text-base font-semibold text-slate-600">{displayPhone(lead.phone)}</p>
            {isPost && (
              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-900">
                Post Site Visit
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={bandChip}>{band}</span>
          {lead.duplicateSources?.length > 0 ? (
            <div className="flex flex-col items-end gap-1">
              <span className="chip bg-rose-100 text-rose-700 font-bold border border-rose-200">
                Repeated ({(lead.duplicates?.length || lead.duplicateSources.length) + 1}x)
              </span>
              <span className="text-[9px] text-rose-600 font-medium text-right max-w-[120px] leading-tight">
                Also found in: {lead.duplicateSources.join(', ')}
              </span>
            </div>
          ) : null}
          {lead.attemptCount > 0 ? (
            <span className="chip bg-slate-100 text-slate-600">Attempt {lead.attemptCount + 1}</span>
          ) : (
            <span className="chip bg-brand-50 text-brand-700">First call</span>
          )}
        </div>
      </div>

      {/* Follow-up banner */}
      {lead.followUpAt ? (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 border border-amber-200">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Callback promised for {formatDateTime(lead.followUpAt, tz)}
        </div>
      ) : null}

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-4 py-3">
        <Field label="Project" value={lead.project} icon={Globe} />
        <Field label="City" value={lead.city} icon={MapPin} />
        <Field label="Budget" value={lead.budget} icon={Wallet} />
        <Field label="Source" value={lead.source} icon={Globe} />
        {lead.altPhone ? <Field label="Alt. phone" value={displayPhone(lead.altPhone)} icon={Phone} /> : null}
        {lead.dateAdded ? <Field label="Added" value={formatDateTime(lead.dateAdded, tz)} icon={Calendar} /> : null}
        {lead.extraData && Object.entries(lead.extraData).map(([key, value]) => (
          <Field key={key} label={key} value={value} />
        ))}
      </div>

      {/* Notes */}
      {lead.notes ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Notes from sheet</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{lead.notes}</p>
        </div>
      ) : null}

      {/* Previous attempts — collapsible */}
      {lead.history?.length ? (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {lead.history.length} previous attempt{lead.history.length > 1 ? 's' : ''}
            </span>
            {historyOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {historyOpen ? (
            <ul className="space-y-2 px-4 pb-3">
              {lead.history.map((h) => (
                <li key={h.id} className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      #{h.attemptNo} · {callCategoryLabel(h.callCategory)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{relativeTime(h.submittedAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {leadStatusCategoryLabel(h.leadStatus)} — {h.by}
                    {h.isOverride ? ' (admin override)' : ''}
                  </p>
                  {h.notes ? <p className="mt-1 text-xs italic text-slate-500">{h.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

