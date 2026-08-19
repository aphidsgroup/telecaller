'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SyncPanel({ configured, spreadsheetId, tab, intervalMinutes }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function run(url, label) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      setResult(
        res.ok && data.ok
          ? { ok: true, text: data.message || `${label}: ${data.assigned ?? data.inserted ?? 0} lead(s) affected.` }
          : { ok: false, text: data.error || `${label} failed` }
      );
      router.refresh();
    } catch (err) {
      setResult({ ok: false, text: String(err.message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ingestion</h2>
          <p className="mt-1 text-sm text-slate-600">
            {configured && spreadsheetId ? (
              <>
                Polling <span className="font-mono text-xs">{spreadsheetId.slice(0, 12)}...</span> tab{' '}
                <strong>{tab || 'Leads'}</strong> every {intervalMinutes} minute(s) through the Sheets API.
              </>
            ) : (
              <>
                Service account not configured. Either add credentials in <strong>.env</strong> or push rows from the
                Apps Script webhook (see docs/google-apps-script.js).
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => run('/api/admin/sync', 'Sync')}>
            {busy ? 'Working...' : 'Sync now'}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => run('/api/admin/distribute', 'Distribution')}>
            Distribute pool
          </button>
        </div>
      </div>
      {result ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
          {result.text}
        </p>
      ) : null}
    </section>
  );
}
