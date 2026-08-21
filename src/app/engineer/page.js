'use client';

import { useState, useEffect } from 'react';
import { MapPin, CheckCircle } from 'lucide-react';
import EngineerLeadCard from '@/components/engineer/EngineerLeadCard';
import FollowupNotifier from '@/components/shared/FollowupNotifier';

export default function EngineerDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  async function fetchLeads() {
    setLoading(true);
    try {
      const res = await fetch('/api/engineer/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
      
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUserId(userData.user?.id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleUpdate = () => {
    fetchLeads(); // Refetch so it moves to updated list
  };

  const pendingLeads = leads
    .filter(l => !l.dispositions.some(d => d.userId === userId))
    .sort((a, b) => {
      // Prioritize hot transfers
      if (a.followupAcceptedAt && !b.followupAcceptedAt) return -1;
      if (!a.followupAcceptedAt && b.followupAcceptedAt) return 1;
      return 0;
    });
  const updatedLeads = leads.filter(l => l.dispositions.some(d => d.userId === userId));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-6 mt-2">
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
          <MapPin className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">My Site Visits</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{pendingLeads.length} Pending</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-10 text-slate-400">Loading...</div>
      ) : (
        <>
          {pendingLeads.length === 0 && updatedLeads.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="font-black text-slate-800 text-lg">You&apos;re all caught up!</h3>
              <p className="text-slate-500 text-sm mt-2 font-medium">No pending site visits assigned to you right now.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <FollowupNotifier />
              
              {pendingLeads.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Pending Action</h2>
                  <div className="space-y-4">
                    {pendingLeads.map(lead => (
                      <EngineerLeadCard key={lead.id} lead={lead} onUpdate={handleUpdate} />
                    ))}
                  </div>
                </div>
              )}
              
              {updatedLeads.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Recently Updated by Me</h2>
                  <div className="space-y-4 opacity-80 hover:opacity-100 transition-opacity">
                    {updatedLeads.map(lead => (
                      <EngineerLeadCard key={lead.id} lead={lead} onUpdate={handleUpdate} isUpdateMode={true} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}


