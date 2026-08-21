'use client';

import { useState } from 'react';
import { MapPin, Phone, User, Calendar, CheckCircle, Navigation } from 'lucide-react';
import { LEAD_STATUS_CATEGORY } from '@/lib/constants';

export default function EngineerLeadCard({ lead, onUpdate }) {
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!status) return alert('Please select a status');
    
    setBusy(true);
    try {
      const res = await fetch('/api/engineer/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, leadStatus: status, notes })
      });
      if (!res.ok) throw new Error(await res.text());
      onUpdate(lead.id); // trigger refresh
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Find extra data fields for display
  const address = lead.city || (lead.extraData && lead.extraData['Location Area']) || 'Location not specified';
  const typeOfLead = lead.extraData && lead.extraData['Type of Lead'];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <User className="w-4 h-4 text-brand-500" />
            {lead.name || 'Unknown'}
          </h3>
          <div className="flex items-center gap-1.5 text-slate-500 mt-1 text-sm font-medium">
            <Phone className="w-3.5 h-3.5" />
            <a href={`tel:${lead.phone}`} className="text-brand-600">{lead.phone}</a>
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="flex items-start gap-2 text-sm text-slate-700">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <span>{address}</span>
        </div>
        
        {typeOfLead && (
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <CheckCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <span>{typeOfLead}</span>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">After Visit Status</label>
          <select 
            className="w-full mt-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            value={status} 
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">-- Select Status --</option>
            {LEAD_STATUS_CATEGORY.filter(s => ['SITE_VISIT_DONE', 'QUOTATION_SENT', 'NEGOTIATING', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED'].includes(s.value)).map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Visit Notes (Optional)</label>
          <textarea 
            className="w-full mt-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all min-h-[80px]"
            value={notes} 
            onChange={e => setNotes(e.target.value)}
            placeholder="Any specific requirements or updates?"
          />
        </div>

        <button 
          onClick={submit} 
          disabled={busy || !status} 
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-brand-500/20 active:scale-[0.98] mt-2"
        >
          {busy ? 'Saving...' : 'Save & Update Lead'}
        </button>
      </div>
    </div>
  );
}
