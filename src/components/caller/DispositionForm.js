'use client';

import { CALL_CATEGORY, CALLBACK_CATEGORIES, LEAD_STATUS_CATEGORY, TERMINAL_LEAD_STATUSES } from '@/lib/constants';

export default function DispositionForm({
  lead,
  form,
  setForm,
  unlocked,
  submitting,
  error,
  onSubmit,
  waHref,
  onWhatsApp,
}) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const showWhatsApp = form.leadStatus === 'SEND_BROCHURE_WHATSAPP';
  const willClose = TERMINAL_LEAD_STATUSES.includes(form.leadStatus);
  const willSchedule = CALLBACK_CATEGORIES.includes(form.callCategory) && !willClose;

  return (
    <form onSubmit={onSubmit} className={`card p-4 ${unlocked ? '' : 'opacity-60'}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2 - Log the outcome</p>
        {!unlocked ? <span className="chip bg-slate-100 text-slate-500">Locked</span> : null}
      </div>

      <fieldset disabled={!unlocked || submitting} className="space-y-4">
        <div>
          <label className="label" htmlFor="callCategory">
            Call category
          </label>
          <select
            id="callCategory"
            className="input"
            value={form.callCategory}
            onChange={(e) => set({ callCategory: e.target.value })}
            required
          >
            <option value="">Select...</option>
            {CALL_CATEGORY.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="leadStatus">
            Lead status category
          </label>
          <select
            id="leadStatus"
            className="input"
            value={form.leadStatus}
            onChange={(e) => set({ leadStatus: e.target.value })}
            required
          >
            <option value="">Select...</option>
            {LEAD_STATUS_CATEGORY.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {showWhatsApp ? (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            onClick={onWhatsApp}
            className="btn w-full bg-[#25D366] py-3 text-white hover:brightness-95"
          >
            Open WhatsApp and send the brochure
          </a>
        ) : null}

        <div>
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            className="input"
            placeholder="What did the customer say?"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>

        {willSchedule ? (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
            This lead will come back to you automatically at the scheduled time - inside working hours, skipping
            weekly offs and company holidays.
          </p>
        ) : null}
        {willClose ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            This closes the lead. The admin can always reopen it.
          </p>
        ) : null}

        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </fieldset>

      <div className="safe-bottom sticky bottom-0 mt-4 bg-white pt-2">
        <button type="submit" className="btn-primary w-full py-4 text-base" disabled={!unlocked || submitting}>
          {submitting ? 'Saving...' : 'Submit and load next lead'}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Lead #{lead?.id?.slice(-6)} - you cannot move on until this is logged.
        </p>
      </div>
    </form>
  );
}
