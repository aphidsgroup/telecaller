'use client';

import { useState, useRef } from 'react';
import { Loader2, MessageSquare, Send, Mic, Square, Trash2 } from 'lucide-react';
import { CALL_CATEGORY, CALLBACK_CATEGORIES, LEAD_STATUS_CATEGORY, TERMINAL_LEAD_STATUSES } from '@/lib/constants';

function ChipGroup({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === o.value ? '' : o.value)}
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

function AudioRecorder({ audioBase64, onAudioData, disabled }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          onAudioData(reader.result);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  if (audioBase64) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 border border-emerald-100">
        <audio src={audioBase64} controls className="h-8 max-w-[200px]" />
        <button type="button" onClick={() => onAudioData('')} className="p-1 text-rose-500 hover:bg-rose-100 rounded">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {recording ? (
        <button type="button" onClick={stopRecording} className="btn-ghost flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200">
          <Square className="h-4 w-4 animate-pulse" /> Stop recording
        </button>
      ) : (
        <button type="button" onClick={startRecording} disabled={disabled} className="btn-ghost flex items-center gap-2 text-slate-600 border border-slate-200">
          <Mic className="h-4 w-4" /> Add voice note
        </button>
      )}
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

        {/* ── Client Details ───────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Client Details (optional)</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="label">Client Name</label>
              <input
                type="text"
                className="input"
                placeholder="Full name"
                value={form.clientName}
                onChange={(e) => set({ clientName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Location Area</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Indiranagar"
                value={form.locationArea}
                onChange={(e) => set({ locationArea: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Built-up Area</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 1200 sqft"
                value={form.builtUpArea}
                onChange={(e) => set({ builtUpArea: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Floor</label>
              <select className="input" value={form.floor || ''} onChange={(e) => set({ floor: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="Ground Floor">Ground Floor</option>
                <option value="G+1">G+1</option>
                <option value="G+2">G+2</option>
                <option value="G+3">G+3</option>
              </select>
            </div>
            <div>
              <label className="label">Type of Lead</label>
              <select className="input" value={form.typeOfLead || ''} onChange={(e) => set({ typeOfLead: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Renovation">Renovation</option>
              </select>
            </div>
            <div>
              <label className="label">Cash or Loan</label>
              <select className="input" value={form.funding} onChange={(e) => set({ funding: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="Cash">Cash</option>
                <option value="Loan">Loan</option>
                <option value="Cash and Loan">Cash and Loan</option>
                <option value="Not Decided">Not Decided</option>
              </select>
            </div>
            <div>
              <label className="label">Starting</label>
              <select className="input" value={form.starting} onChange={(e) => set({ starting: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="Immediately">Immediately</option>
                <option value="Within 1 month">Within 1 month</option>
                <option value="Within 3 months">Within 3 months</option>
                <option value="More than 3 months">More than 3 months</option>
              </select>
            </div>
          </div>
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
          <div className="flex justify-between items-center">
            <AudioRecorder 
              audioBase64={form.audioBase64} 
              onAudioData={(d) => set({ audioBase64: d })} 
              disabled={!unlocked || submitting} 
            />
            {form.notes ? (
              <p className="mt-1 text-right text-[10px] text-slate-400">{form.notes.length}/500</p>
            ) : null}
          </div>
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
