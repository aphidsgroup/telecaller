'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { LEAD_STATUS_CATEGORY } from '@/lib/constants';

function getStatusLabel(status, lastLeadStatus) {
  if (lastLeadStatus) {
    const found = LEAD_STATUS_CATEGORY.find(c => c.value === lastLeadStatus);
    return found ? found.label : lastLeadStatus;
  }
  return status;
}

export default function LeadSearchBox({ params, companies = [], hideCompanyFilter = false }) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const [q, setQ] = useState(params.q || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function apply(patch) {
    const next = new URLSearchParams(search.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  }

  useEffect(() => {
    if (!q || q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/leads/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="card p-4 flex flex-col md:flex-row gap-4 items-start md:items-center bg-white shadow-sm rounded-2xl border border-slate-100">
      <div className="relative flex-1 w-full max-w-xl">
        <form onSubmit={(e) => { e.preventDefault(); apply({ q }); setOpen(false); }} className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            className="input pl-10 w-full"
            placeholder="Search leads by phone number..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-400 absolute right-3 top-3 animate-spin" />}
        </form>

        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">
              Found {results.length} matching leads
            </div>
            {results.map(lead => (
              <div key={lead.id} className="p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer" onMouseDown={() => { setQ(lead.phone); apply({ q: lead.phone }); setOpen(false); }}>
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-slate-900">{lead.name}</div>
                  <div className="text-xs font-mono font-medium text-slate-600">{lead.phone}</div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="text-[10px] font-bold text-brand-600 uppercase">{lead.company?.name || 'No Company'}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 rounded-full">
                    {getStatusLabel(lead.status, lead.lastLeadStatus)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {open && q.length >= 3 && results.length === 0 && !loading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-50 p-4 text-center">
            <p className="text-sm text-slate-500 font-medium">No leads found with this number</p>
            <p className="text-xs text-slate-400 mt-1">This number is safe to upload.</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        {!hideCompanyFilter && (
          <select className="input" value={params.companyId || ''} onChange={(e) => apply({ companyId: e.target.value })}>
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button onClick={() => apply({ q })} className="btn-primary whitespace-nowrap">Search</button>
        {(q || params.companyId) && (
          <button onClick={() => { setQ(''); router.push(pathname); }} className="btn-ghost whitespace-nowrap">Reset</button>
        )}
      </div>
    </div>
  );
}
