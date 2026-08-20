
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ManagerAddLeadForm({ companies, userCompanyId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  
  const [form, setForm] = useState({
    companyId: userCompanyId || (companies.length > 0 ? companies[0].id : ''),
    typeOfLead: 'Construction: Labour Contract',
    phone: '',
    name: '',
    locationArea: '',
    builtUpArea: '',
    funding: 'Cash',
    starting: 'Immediately'
  });

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
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-black text-slate-800 mb-6">Add Manual Lead</h2>
        
        {message && (
          <div className={"p-3 rounded-xl mb-6 text-sm font-bold \"}>
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
            <label className="label">Type of Lead</label>
            <select className="input" value={form.typeOfLead} onChange={e => setForm({...form, typeOfLead: e.target.value})}>
              <optgroup label="Construction">
                <option value="Construction: Labour Contract">Labour Contract</option>
                <option value="Construction: Material Contract">Material Contract</option>
              </optgroup>
              <optgroup label="Interior">
                <option value="Interior: Labour Contract">Labour Contract</option>
                <option value="Interior: Material Contract">Material Contract</option>
              </optgroup>
            </select>
          </div>
          
          <div>
            <label className="label">Phone Number *</label>
            <input type="tel" className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required placeholder="e.g. 9876543210" />
          </div>

          <div>
            <label className="label">Client Name</label>
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
            <label className="label">Cash or Loan</label>
            <select className="input" value={form.funding} onChange={e => setForm({...form, funding: e.target.value})}>
              <option value="Cash">Cash</option>
              <option value="Loan">Loan</option>
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

