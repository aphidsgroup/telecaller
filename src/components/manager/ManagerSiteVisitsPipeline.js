'use client';

import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { leadStatusCategoryLabel } from '@/lib/constants';

export default function ManagerSiteVisitsPipeline({ initialLeads, users }) {
  const [leads, setLeads] = useState(initialLeads);
  const [assigning, setAssigning] = useState(null);

  async function handleAssign(leadId, userId) {
    setAssigning(leadId);
    try {
      const res = await fetch('/api/manager/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, userId })
      });
      if (res.ok) {
        setLeads(leads.map(l => l.id === leadId ? { ...l, assignedToId: userId, assignedTo: users.find(u => u.id === userId) } : l));
      } else {
        throw new Error('Failed to assign');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setAssigning(null);
    }
  }

  if (leads.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
        <MapPin className="w-4 h-4 text-brand-500" /> Site Visits Pipeline
      </h2>
      <div className="space-y-3">
        {leads.map(lead => (
          <div key={lead.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-slate-800">{lead.name || 'Unknown'}</div>
                <div className="text-sm font-semibold text-slate-500">{lead.phone}</div>
                {lead.dispositions?.[0]?.notes && (
                  <div className="text-[11px] text-slate-600 mt-2 italic border-l-2 border-brand-200 pl-2">
                    "{lead.dispositions[0].notes}"
                  </div>
                )}
                {lead.dispositions?.[0]?.audioBase64 && (
                  <div className="mt-2">
                    <audio src={lead.dispositions[0].audioBase64} controls className="h-8 max-w-[200px]" />
                  </div>
                )}
              </div>
              <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold uppercase">
                {leadStatusCategoryLabel(lead.lastLeadStatus)}
              </span>
            </div>
            
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Assign To</span>
              <div className="relative">
                <select 
                  disabled={assigning === lead.id}
                  value={lead.assignedToId || ''}
                  onChange={(e) => handleAssign(lead.id, e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                >
                  <option value="">-- Unassigned --</option>
                  <optgroup label="Site Engineers">
                    {users.filter(u => u.role === 'SITE_ENGINEER').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Telecallers">
                    {users.filter(u => u.role === 'TELECALLER').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
