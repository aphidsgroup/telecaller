'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { displayPhone, formatDateTime } from '@/lib/format';

export default function DuplicateList({ duplicates, tz }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');

  async function resolve(id, resolution) {
    setBusy(id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/duplicates/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not resolve');
      setMessage('Duplicate resolved.');
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(null);
    }
  }

  if (!duplicates.length) {
    return <div className="card p-6 text-center text-sm text-slate-500">No duplicates waiting. Clean sheet.</div>;
  }

  return (
    <div className="space-y-2">
      {message ? <p className="text-sm text-brand-700">{message}</p> : null}
      {duplicates.map((d) => {
        let raw = {};
        try {
          raw = d.rawRow ? JSON.parse(d.rawRow) : {};
        } catch {
          raw = {};
        }
        return (
          <div key={d.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {d.name || 'Unnamed'} - <span className="font-mono">{displayPhone(d.phone)}</span>
              </p>
              <p className="text-xs text-slate-500">
                Row {d.sourceRow || '?'} uploaded {formatDateTime(d.createdAt, tz)} - already exists as{' '}
                <Link href={`/admin/leads/${d.existingLeadId}`} className="text-brand-600 underline">
                  {d.existingLead?.name || 'existing lead'}
                </Link>
              </p>
              {raw.notes ? <p className="mt-1 text-xs italic text-slate-500">New notes: {raw.notes}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" disabled={busy === d.id} onClick={() => resolve(d.id, 'IGNORED')}>
                Ignore
              </button>
              <button className="btn-ghost" disabled={busy === d.id} onClick={() => resolve(d.id, 'MERGED_NOTES')}>
                Merge notes
              </button>
              <button className="btn-ghost" disabled={busy === d.id} onClick={() => resolve(d.id, 'FORCED_NEW')}>
                Create anyway
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
