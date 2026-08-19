'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CALL_CATEGORY, LEAD_STATUS_CATEGORY } from '@/lib/constants';

export default function LeadAdminPanel({ lead, telecallers }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [assignee, setAssignee] = useState(lead.assignedToId || '');
  const [override, setOverride] = useState({
    callCategory: lead.lastCallCategory || '',
    leadStatus: lead.lastLeadStatus || '',
    notes: '',
    followUpAt: '',
  });

  async function send(body, okMessage) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Update failed');
      setMessage(okMessage);
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Admin controls</h2>
        {message ? <span className="text-xs font-medium text-brand-700">{message}</span> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Assign / reassign</label>
          <div className="flex gap-2">
            <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned pool</option>
              {telecallers.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.isActive}>
                  {t.name}
                  {t.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
            <button
              className="btn-primary shrink-0"
              disabled={busy}
              onClick={() => send({ action: 'assign', userId: assignee || null }, 'Assignment updated')}
            >
              Save
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Reassigning a lead that is open on somebody screen takes it off them immediately.
          </p>
        </div>

        <div>
          <label className="label">Priority &amp; flags</label>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => send({ priority: lead.priority > 0 ? 0 : 5 }, 'Priority updated')}
            >
              {lead.priority > 0 ? 'Remove priority' : 'Mark hot (jump queue)'}
            </button>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => send({ isDnd: !lead.isDnd }, 'DND flag updated')}
            >
              {lead.isDnd ? 'Clear DND' : 'Mark DND'}
            </button>
            {lead.flaggedForReview ? (
              <button className="btn-ghost" disabled={busy} onClick={() => send({ clearFlag: true }, 'Flag cleared')}>
                Clear review flag
              </button>
            ) : null}
            {lead.status === 'CLOSED' ? (
              <button className="btn-ghost" disabled={busy} onClick={() => send({ reopen: true }, 'Lead reopened')}>
                Reopen lead
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Override status</summary>
        <p className="mt-2 text-xs text-slate-500">
          Overrides never rewrite history - they append a new entry attributed to you.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Call category</label>
            <select
              className="input"
              value={override.callCategory}
              onChange={(e) => setOverride({ ...override, callCategory: e.target.value })}
            >
              <option value="">Keep current</option>
              {CALL_CATEGORY.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Lead status</label>
            <select
              className="input"
              value={override.leadStatus}
              onChange={(e) => setOverride({ ...override, leadStatus: e.target.value })}
            >
              <option value="">Select...</option>
              {LEAD_STATUS_CATEGORY.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Follow-up date/time</label>
            <input
              type="datetime-local"
              className="input"
              value={override.followUpAt}
              onChange={(e) => setOverride({ ...override, followUpAt: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Reason / notes</label>
            <input
              className="input"
              value={override.notes}
              onChange={(e) => setOverride({ ...override, notes: e.target.value })}
              placeholder="Why are you overriding this?"
            />
          </div>
        </div>
        <button
          className="btn-primary mt-3"
          disabled={busy || (!override.leadStatus && !override.followUpAt)}
          onClick={() =>
            send(
              {
                callCategory: override.callCategory || null,
                leadStatus: override.leadStatus || null,
                notes: override.notes,
                followUpAt: override.followUpAt ? new Date(override.followUpAt).toISOString() : null,
              },
              'Override recorded'
            )
          }
        >
          Apply override
        </button>
      </details>
    </section>
  );
}
