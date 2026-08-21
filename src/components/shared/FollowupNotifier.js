'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, X } from 'lucide-react';

export default function FollowupNotifier() {
  const router = useRouter();
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/user/pending-followups');
        if (res.ok) {
          const data = await res.json();
          if (data.followups) setPending(data.followups);
        }
      } catch (e) {
        // silently fail polling
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleRespond(leadId, accept) {
    setBusy(true);
    try {
      await fetch('/api/user/respond-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, accept })
      });
      setPending(prev => prev.filter(p => p.id !== leadId));
      if (accept) {
        // If they accept, reload the page so the queue/dashboard picks it up immediately
        router.refresh();
      }
    } catch (e) {
      alert('Failed to respond. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-rose-500 p-4 text-center">
          <AlertTriangle className="w-8 h-8 text-white mx-auto mb-2" />
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Immediate Follow-up!</h3>
        </div>
        
        <div className="p-5">
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Lead Details</p>
            <p className="text-base font-bold text-slate-800">{pending[0].name}</p>
            <p className="text-sm font-medium text-brand-600">{pending[0].phone}</p>
          </div>
          
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 mb-5">
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wide mb-1">Admin Note:</p>
            <p className="text-sm text-slate-700 italic">&quot;{pending[0].followupMessage}&quot;</p>
          </div>

          <div className="flex gap-3">
            <button 
              disabled={busy}
              onClick={() => handleRespond(pending[0].id, false)}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <X size={16} /> Decline
            </button>
            <button 
              disabled={busy}
              onClick={() => handleRespond(pending[0].id, true)}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-600 disabled:opacity-50 transition-colors shadow-lg shadow-rose-200"
            >
              <Check size={16} /> Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
