'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';

export default function DeadLeadsActions({ leadId, leadName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    if (!confirm('Restore this lead? It will be moved back to the unassigned pool.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/leads/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) router.refresh();
      else alert('Failed to restore lead');
    } finally { setBusy(false); }
  }

  async function deleteLead() {
    if (!confirm('Permanently delete this lead? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/leads/' + leadId, { method: 'DELETE' });
      if (res.ok) router.refresh();
      else alert('Failed to delete lead');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={restore}
        disabled={busy}
        title="Restore lead"
        className="text-[11px] font-semibold text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" /> Restore
      </button>
      <button
        onClick={deleteLead}
        disabled={busy}
        title="Permanently delete"
        className="text-[11px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
      >
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </div>
  );
}
