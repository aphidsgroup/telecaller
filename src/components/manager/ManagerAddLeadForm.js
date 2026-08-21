
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LEAD_STATUS_CATEGORY } from '@/lib/constants';

export default function ManagerAddLeadForm({ companies, userCompanyId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  
  const [form, setForm] = useState({
    companyId: userCompanyId || (companies.length > 0 ? companies[0].id : ''),
    typeOfLead: '',
    floor: '',
    phone: '',
    name: '',
    locationArea: '',
    builtUpArea: '',
    funding: 'Cash',
    starting: 'Immediately',
    status: 'UNASSIGNED'
  });

  useEffect(() => {
    if (form.phone.length >= 10) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/manager/search?q=${encodeURIComponent(form.phone)}`);
          if (res.ok) {
            const data = await res.json();
            setDuplicates(data.leads || []);
          }
        } catch (e) {
          // ignore
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setDuplicates([]);
    }
  }, [form.phone]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/manager/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to add lead');
      
      setMessage('Lead added successfully!');
      setForm({ ...form, phone: '', name: '', locationArea: '', builtUpArea: '' }); // reset some fields
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      
      {/* Dedicated Search Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          Check Existing Lead
        </h2>
        <div className="relative">
          <input 
            type="tel" 
            placeholder="Search phone number to check if lead exists..." 
            className="w-full text-sm py-3 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
            value={form.phone}
            onChange={e => setForm({...form, phone: e.target.value})}
          />
        </div>
        {duplicates.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Lead Already Exists in Database
            </p>
            <div className="space-y-2">
              {duplicates.map(dup => (
                <div key={dup.id} className="text-xs text-amber-900 bg-amber-100/50 p-2 rounded-lg flex flex-col gap-1">
                  <div className="flex justify-between font-bold">
                    <span>{dup.name || 'Unknown'}</span>
                    <span>{dup.phone}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>Status: {LEAD_STATUS_CATEGORY[dup.lastLeadStatus] || dup.status}</span>
                    <span>Assigned: {dup.assignedTo?.name || 'Unassigned'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-black text-slate-800 mb-6">Add Manual Lead</h2>
        
        {message && (
          <div className={`p-3 rounded-xl mb-6 text-sm font-bold ${message.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {message}
          </div>
        )}
        
        <form onSubmit={submit} className="space-y-4">
          {!userCompanyId && companies.length > 0 && (
            <div>
              <label className="label">Company</label>
              <select className="input" value={form.companyId} onChange={e => setForm({...form, companyId: e.target.value})}>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          
          <div>
            <label className="label">Phone Number *</label>
            <input type="tel" className="input bg-slate-50" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required placeholder="e.g. 9876543210" />
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Auto-syncs with the search bar above.</p>
          </div>

          <div>
            <label className="label">Type of Lead</label>
            <select className="input" value={form.typeOfLead} onChange={e => setForm({...form, typeOfLead: e.target.value})}>
              <option value="">-- Select --</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Renovation">Renovation</option>
            </select>
          </div>
          
          <div>
            <label className="label">Name</label>
            <input type="text" className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Optional" />
          </div>
          
          <div>
            <label className="label">Location Area</label>
            <input type="text" className="input" value={form.locationArea} onChange={e => setForm({...form, locationArea: e.target.value})} placeholder="e.g. Indiranagar" />
          </div>
          
          <div>
            <label className="label">Total Built-up Area</label>
            <input type="text" className="input" value={form.builtUpArea} onChange={e => setForm({...form, builtUpArea: e.target.value})} placeholder="e.g. 1200 sqft" />
          </div>
          
          <div>
            <label className="label">Floor</label>
            <select className="input" value={form.floor || ''} onChange={e => setForm({...form, floor: e.target.value})}>
              <option value="">-- Select --</option>
              <option value="Ground Floor">Ground Floor</option>
              <option value="G+1">G+1</option>
              <option value="G+2">G+2</option>
              <option value="G+3">G+3</option>
            </select>
          </div>
          
          <div>
            <label className="label">Cash or Loan</label>
            <select className="input" value={form.funding} onChange={e => setForm({...form, funding: e.target.value})}>
              <option value="Cash">Cash</option>
              <option value="Loan">Loan</option>
              <option value="Cash and Loan">Cash and Loan</option>
              <option value="Not Decided">Not Decided</option>
            </select>
          </div>
          
          <div>
            <label className="label">Starting</label>
            <select className="input" value={form.starting} onChange={e => setForm({...form, starting: e.target.value})}>
              <option value="Immediately">Immediately</option>
              <option value="Within 1 month">Within 1 month</option>
              <option value="Within 3 months">Within 3 months</option>
              <option value="More than 3 months">More than 3 months</option>
            </select>
          </div>
          
          <div>
            <label className="label">Lead Status</label>
            <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="UNASSIGNED">Unassigned / Fresh Lead</option>
              <optgroup label="Mark as closed / disposition">
                {LEAD_STATUS_CATEGORY.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          
          <div className="pt-4">
            <button type="submit" disabled={busy} className="w-full btn-primary py-3 text-sm">
              {busy ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

