'use client';

import { Loader2, MessageSquare, Send } from 'lucide-react';
import { CALL_CATEGORY, CALLBACK_CATEGORIES, LEAD_STATUS_CATEGORY, TERMINAL_LEAD_STATUSES } from '@/lib/constants';

function ChipGroup({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-100 ${
            value === o.value
              ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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
    <form onSubmit={onSubmit} className={`card overflow-hidden transition-opacity duration-200 ${unlocked ? '' : 'opacity-50'}`}>
      {/* Step header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-white">2</span>
          <p className="text-sm font-semibold text-slate-800">Log the outcome</p>
        </div>
        {!unlocked ? (
          <span className="chip bg-slate-100 text-slate-500 text-[10px]">Complete Step 1 first</span>
        ) : null}
      </div>

      <fieldset disabled={!unlocked || submitting} className="space-y-5 p-4">
        {/* Call category */}
        <div>
          <label className="label">What happened on the call?</label>
          <ChipGroup
            options={CALL_CATEGORY}
            value={form.callCategory}
            onChange={(v) => set({ callCategory: v })}
            disabled={!unlocked || submitting}
          />
        </div>

        {/* Lead status */}
        <div>
          <label className="label">Lead status</label>
          <ChipGroup
            options={LEAD_STATUS_CATEGORY}
            value={form.leadStatus}
            onChange={(v) => set({ leadStatus: v })}
            disabled={!unlocked || submitting}
          />
        </div>

        {/* WhatsApp button */}
        {showWhatsApp ? (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            onClick={onWhatsApp}
            className="btn w-full bg-[#25D366] py-3.5 text-white hover:brightness-95 shadow-sm"
          >
            <MessageSquare className="h-4 w-4" />
            Send brochure on WhatsApp
          </a>
        ) : null}

        {/* Notes */}
        <div>
          <label className="label" htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            rows={3}
            className="input resize-none"
            placeholder="What did the customer say?"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            maxLength={500}
          />
          {form.notes ? (
            <p className="mt-1 text-right text-[10px] text-slate-400">{form.notes.length}/500</p>
          ) : null}
        </div>

        {/* Hints */}
        {willSchedule ? (
          <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5 text-xs text-brand-800 font-medium">
            📅 This lead will return to you automatically at the scheduled time, inside working hours.
          </div>
        ) : null}
        {willClose ? (
          <div className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 font-medium">
            ✓ This will close the lead. The admin can reopen it if needed.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-700 font-medium">
            {error}
          </div>
        ) : null}
      </fieldset>

      {/* Sticky submit */}
      <div className="safe-bottom sticky bottom-0 border-t border-slate-100 bg-white/95 backdrop-blur px-4 pt-3 pb-4">
        <button
          type="submit"
          className="btn-primary w-full py-4 text-base"
          disabled={!unlocked || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit &amp; load next lead
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          Ref: {lead?.id?.slice(-6)} · You cannot skip ahead without logging.
        </p>
      </div>
    </form>
  );
}
