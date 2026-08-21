'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BulkLeadAdder({ companies = [] }) {
  const router = useRouter();
  const [numbers, setNumbers] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e) {
    e.preventDefault();
    const list = numbers.split('\n').map(n => n.trim()).filter(Boolean);
    if (list.length === 0) return;
    
    setBusy(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/admin/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: list, companyId: companyId || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to add leads');
      setMessage(`Successfully added ${data.count} leads.`);
      setNumbers('');
      router.refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 space-y-3 bg-slate-50 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Quick Add Bulk Numbers</h3>
        {message && (
          <span className={`text-xs font-semibold ${message.includes('added') ? 'text-emerald-600' : 'text-rose-600'}`}>
            {message}
          </span>
        )}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <select 
          className="input" 
          value={companyId} 
          onChange={e => setCompanyId(e.target.value)}
          disabled={busy}
        >
          <option value="">No Company (Unassigned)</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <textarea
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
          placeholder="Paste phone numbers here, one per line..."
          className="input min-h-[100px] resize-y font-mono text-sm"
          disabled={busy}
        />
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy || !numbers.trim()}>
            {busy ? 'Adding...' : 'Add leads'}
          </button>
        </div>
      </form>
    </div>
  );
}
