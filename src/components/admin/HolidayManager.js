'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';

export default function HolidayManager({ holidays }) {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(method, body) {
    setBusy(true);
    try {
      await fetch('/api/admin/holidays', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label">Occasion</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali" />
        </div>
        <button
          className="btn-primary"
          disabled={!date || busy}
          onClick={() => {
            call('POST', { date, name });
            setDate('');
            setName('');
          }}
        >
          Add holiday
        </button>
      </div>

      {holidays.length ? (
        <ul className="flex flex-wrap gap-2">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm">
              <span className="font-medium text-slate-800">{formatDate(h.date)}</span>
              <span className="text-slate-500">{h.name}</span>
              <button
                className="text-xs font-semibold text-rose-600 underline"
                disabled={busy}
                onClick={() => call('DELETE', { id: h.id })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No company holidays configured.</p>
      )}
    </div>
  );
}
