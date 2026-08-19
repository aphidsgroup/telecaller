'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SyncPanel({ configured, spreadsheetId, tab, intervalMinutes, companies = [] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [link, setLink] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  async function handleStartSync(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      let extractedId = spreadsheetId;
      if (link) {
        // Extract from link, e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
        const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) extractedId = match[1];
        else extractedId = link; // fallback if they just pasted the ID

        // Save it first
        const putRes = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 'sheets.spreadsheetId': extractedId }),
        });
        if (!putRes.ok) throw new Error('Failed to save Sheet ID');
      }

      // Now run sync
      const res = await fetch('/api/admin/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId || null })
      });
      const data = await res.json();
      setResult(
        res.ok && data.ok
          ? { ok: true, text: data.message || `Sync successful: ${data.assigned ?? data.inserted ?? 0} lead(s) affected.` }
          : { ok: false, text: data.error || 'Sync failed' }
      );
      setLink('');
      router.refresh();
    } catch (err) {
      setResult({ ok: false, text: String(err.message) });
    } finally {
      setBusy(false);
    }
  }

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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Ingestion</h2>
          
          <form onSubmit={handleStartSync} className="flex flex-col gap-2 w-full max-w-lg">
            <div className="flex gap-2 w-full">
              <input 
                type="text" 
                className="input text-sm flex-1" 
                placeholder={spreadsheetId ? "Paste new Google Sheet Link..." : "Paste Google Sheet Link here..."}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                disabled={busy}
              />
              <select className="input text-sm w-48" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} disabled={busy}>
                <option value="">(No Company)</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <button type="submit" className="btn-primary" disabled={busy || (!link && !spreadsheetId)}>
                {busy ? 'Working...' : 'Start sync'}
              </button>
            </div>
          </form>

          <p className="text-sm text-slate-600">
            {configured && spreadsheetId ? (
              <>
                Polling <span className="font-mono text-xs">{spreadsheetId.slice(0, 12)}...</span> tab{' '}
                <strong>{tab || 'Leads'}</strong> every {intervalMinutes} minute(s) through the Sheets API.
              </>
            ) : (
              <>
                Service account not configured. Set the Sheet link above, and ensure credentials exist in <strong>.env</strong>.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 md:mt-0">
          <button className="btn-ghost whitespace-nowrap" disabled={busy} onClick={() => run('/api/admin/distribute', 'Distribution')}>
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
