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
  const [deletingId, setDeletingId] = useState(null);

  const allSelected = leads.length > 0 && selected.length === leads.length;

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function deleteLead(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed');
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
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
              <th className="th">Actions</th>
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
                <td className="td">
                  <select
                    className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 hover:bg-slate-100 cursor-pointer w-full max-w-[120px] truncate"
                    value={lead.assignedTo?.id || ''}
                    onChange={async (e) => {
                      const newUserId = e.target.value;
                      const res = await fetch(`/api/admin/leads/${lead.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'assign', userId: newUserId || null })
                      });
                      if (res.ok) router.refresh();
                      else alert('Failed to assign lead');
                    }}
                  >
                    <option value="">Unassigned Pool</option>
                    {telecallers.map((t) => (
                      <option key={t.id} value={t.id} disabled={!t.isActive}>
                        {t.name} {t.isActive ? '' : '(inactive)'}
                      </option>
                    ))}
                  </select>
                </td>
                  <div>
                    <select
                      className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 hover:bg-slate-100 cursor-pointer w-full max-w-[200px] truncate mb-2"
                      value={lead.lastLeadStatus || ''}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        if (!newStatus) return;
                        const res = await fetch(`/api/admin/leads/${lead.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadStatus: newStatus, notes: 'Status updated by admin' })
                        });
                        if (res.ok) router.refresh();
                      }}
                    >
                      <option value="">— Set status —</option>
                      {LEAD_STATUS_CATEGORY.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>

                    {lead.dispositions && lead.dispositions.length > 0 && (
                      <div className="space-y-2 relative before:absolute before:inset-0 before:ml-[3px] before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
                        {lead.dispositions.map((disp, idx) => (
                          <div key={idx} className="relative flex items-start gap-2 max-w-[200px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1 shrink-0 relative z-10 shadow-sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold text-slate-700 leading-tight">
                                {leadStatusCategoryLabel(disp.leadStatus)}
                              </div>
                              <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                                {formatDateTime(disp.submittedAt, tz)} &bull; {disp.user?.name} {disp.user?.role === 'SITE_ENGINEER' ? '(Eng)' : ''}
                              </div>
                              {disp.notes && (
                                <div className="text-[9px] text-slate-600 mt-1 italic border-l-2 border-brand-200 pl-1.5 line-clamp-2" title={disp.notes}>
                                  &quot;{disp.notes}&quot;
                                </div>
                              )}
                              {disp.audioBase64 && (
                                <div className="mt-1">
                                  <audio src={disp.audioBase64} controls className="h-5 w-full" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                <td className="td text-center">
                  <button
                    onClick={() => deleteLead(lead.id, lead.name)}
                    disabled={deletingId === lead.id}
                    className="text-[11px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === lead.id ? '...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
