'use client';

import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import EngineerLeadCard from '@/components/engineer/EngineerLeadCard';

export default function EngineerDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchLeads() {
    setLoading(true);
    try {
      const res = await fetch('/api/engineer/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleUpdate = (id) => {
    setLeads(leads.filter(l => l.id !== id));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-6 mt-2">
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
          <MapPin className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">My Site Visits</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{leads.length} Pending</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-10 text-slate-400">Loading...</div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="font-black text-slate-800 text-lg">You&apos;re all caught up!</h3>
          <p className="text-slate-500 text-sm mt-2 font-medium">No pending site visits assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map(lead => (
            <EngineerLeadCard key={lead.id} lead={lead} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckCircle(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
