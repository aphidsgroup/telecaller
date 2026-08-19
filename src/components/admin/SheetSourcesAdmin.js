'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Link as LinkIcon, Plus, Check, X, RefreshCw } from 'lucide-react';

export default function SheetSourcesAdmin({ companies, sources }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  
  // New source state
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [tab, setTab] = useState('Leads');

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    
    let extractedId = link;
    const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) extractedId = match[1];

    try {
      const res = await fetch('/api/admin/sheet-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, spreadsheetId: extractedId, sheetTab: tab, companyId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }
      setAdding(false);
      setName('');
      setLink('');
      setTab('Leads');
      setCompanyId('');
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(source) {
    setBusy(true);
    try {
      await fetch(`/api/admin/sheet-sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...source, isActive: !source.isActive }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this sheet source? It will no longer sync.')) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/sheet-sources/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSync(sourceId = null) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      alert(`Sync triggered successfully!`);
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-lg font-bold text-slate-800">Connected Sheets</h2>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-2" onClick={() => handleSync()} disabled={busy || sources.length === 0}>
            <RefreshCw className="h-4 w-4" /> Sync All Active
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setAdding(true)} disabled={busy || adding}>
            <Plus className="h-4 w-4" /> Add Sheet
          </button>
        </div>
      </div>

      {adding && (
        <form className="card p-4 space-y-4 bg-brand-50 border-brand-200" onSubmit={handleCreate}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">Sheet Name</label>
              <input required className="input" placeholder="e.g. Material Leads" value={name} onChange={e => setName(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="label">Company</label>
              <select required className="input" value={companyId} onChange={e => setCompanyId(e.target.value)} disabled={busy}>
                <option value="">Select company...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Google Sheet Link / ID</label>
              <input required className="input" placeholder="Paste link here..." value={link} onChange={e => setLink(e.target.value)} disabled={busy} />
            </div>
            <div>
              <label className="label">Tab Name</label>
              <input required className="input" placeholder="e.g. Leads" value={tab} onChange={e => setTab(e.target.value)} disabled={busy} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>Save Sheet</button>
          </div>
        </form>
      )}

      {sources.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No sheets connected yet. Add one to automatically sync leads for your companies.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sources.map(source => (
            <div key={source.id} className={`card p-4 flex flex-col justify-between space-y-3 ${source.isActive ? '' : 'opacity-60 bg-slate-50'}`}>
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-800">{source.name}</h3>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => handleSync(source.id)} disabled={busy || !source.isActive} className={`p-1.5 rounded-lg transition-colors ${source.isActive ? 'text-brand-600 hover:bg-brand-50' : 'text-slate-400'}`} title="Sync now">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => toggleActive(source)} disabled={busy} className={`p-1.5 rounded-lg transition-colors ${source.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`} title={source.isActive ? 'Active' : 'Paused'}>
                      {source.isActive ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => handleDelete(source.id)} disabled={busy} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide mt-1">{source.company?.name || 'No Company'}</p>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span className="font-mono truncate" title={source.spreadsheetId}>{source.spreadsheetId.slice(0, 15)}...</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-600">Tab:</span> {source.sheetTab}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
