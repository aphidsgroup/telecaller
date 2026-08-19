'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ExportPanel({ params }) {
  const router = useRouter();
  const [from, setFrom] = useState(params.from || '');
  const [to, setTo] = useState(params.to || '');

  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);

  return (
    <div className="card flex flex-wrap items-end gap-3 p-3">
      <div>
        <label className="label">From</label>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <button
        className="btn-ghost"
        onClick={() => router.push(`/admin/reports?${qs.toString()}`)}
      >
        Apply
      </button>
      <a className="btn-primary" href={`/api/admin/export?type=leads&${qs.toString()}`}>
        Leads CSV
      </a>
      <a className="btn-primary" href={`/api/admin/export?type=activity&${qs.toString()}`}>
        Call log CSV
      </a>
    </div>
  );
}
