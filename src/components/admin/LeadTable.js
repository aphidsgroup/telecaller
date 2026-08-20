'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StatusChip } from './Ui';
import { callCategoryLabel, leadStatusCategoryLabel, LEAD_STATUS_CATEGORY } from '@/lib/constants';
import { displayPhone, formatDateTime, relativeTime } from '@/lib/format';

export default function LeadTable({ leads, telecallers, tz }) {
  const router = useRouter();
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const allSelected = leads.length > 0 && selected.length === leads.length;

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function bulkAssign() {
    if (!selected.length) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selected, userId: target || null, action: 'assign' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Assignment failed');
      setMessage(`${data.updated} lead(s) ${target ? 'reassigned' : 'returned to the pool'}.`);
      setSelected([]);
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(false);
    }
  }

  if (!leads.length) {
    return <div className="card p-10 text-center text-sm text-slate-500">No leads match these filters.</div>;
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="card flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50 p-3">
          <span className="text-sm font-semibold text-brand-900">{selected.length} selected</span>
          <select className="input max-w-xs" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Return to unassigned pool</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.isActive}>
                {t.name}
                {t.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={bulkAssign} disabled={busy}>
            {busy ? 'Applying...' : 'Apply'}
          </button>
          <button className="btn-ghost" onClick={() => setSelected([])}>
            Clear
          </button>
          {message ? <span className="text-sm text-brand-900">{message}</span> : null}
        </div>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? leads.map((l) => l.id) : [])}
                  aria-label="Select all"
                />
              </th>
              <th className="th">Lead</th>
              <th className="th">Status</th>
              <th className="th">Telecaller</th>
              <th className="th">Last outcome</th>
              <th className="th">Uploaded</th>
              <th className="th">Next follow-up</th>
              <th className="th">Attempts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className={lead.flaggedForReview ? 'bg-rose-50/60' : undefined}>
                <td className="td">
                  <input
                    type="checkbox"
                    checked={selected.includes(lead.id)}
                    onChange={() => toggle(lead.id)}
                    aria-label={`Select ${lead.name}`}
                  />
                </td>
                <td className="td">
                  <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {lead.name}
                  </Link>
                  <div className="font-mono text-xs text-slate-500">{displayPhone(lead.phone)}</div>
                  <div className="text-xs text-slate-400">
                    {[lead.project, lead.city].filter(Boolean).join(' - ') || 'No project set'}
                  </div>
                  {lead.company ? (
                    <div className="text-[10px] font-semibold text-brand-600 uppercase tracking-wide mt-1">{lead.company.name}</div>
                  ) : null}
                  {lead.flaggedForReview ? (
                    <div className="mt-1 text-xs font-semibold text-rose-600">{lead.flagReason || 'Flagged'}</div>
                  ) : null}
                </td>
                <td className="td">
                  <StatusChip status={lead.status} />
                </td>
                <td className="td">{lead.assignedTo?.name || <span className="text-slate-400">Pool</span>}</td>
                <td className="td">
                  {lead.lastLeadStatus ? (
                    <div>
                      <select
                        className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 hover:bg-slate-100 cursor-pointer w-full max-w-[150px] truncate"
                        value={lead.lastLeadStatus}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          const res = await fetch(`/api/admin/leads/${lead.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ leadStatus: newStatus, notes: 'Status updated from table' })
                          });
                          if (res.ok) router.refresh();
                        }}
                      >
                        {LEAD_STATUS_CATEGORY.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <div className="text-[11px] text-slate-500 mt-1">{callCategoryLabel(lead.lastCallCategory)}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400">Not called yet</span>
                  )}
                </td>
                <td className="td text-xs text-slate-500">{formatDateTime(lead.createdAt, tz)}</td>
                <td className="td text-xs">
                  {lead.followUpAt ? (
                    <span className={new Date(lead.followUpAt) <= new Date() ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                      {formatDateTime(lead.followUpAt, tz)}
                      <div className="text-[11px] text-slate-400">{relativeTime(lead.followUpAt)}</div>
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="td text-center">{lead.attemptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
