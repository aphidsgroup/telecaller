'use client';

import { useState } from 'react';
import { Phone, ChevronDown, MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react';
import { LEAD_STATUS_CATEGORY, leadStatusCategoryLabel, LEAD_STATUS_LABEL } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

export default function ManagerLeadCard({ initialLead, users, showCompany = false, neutralDropdowns = false }) {
  const [lead, setLead] = useState(initialLead);
  const [assigning, setAssigning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);
  const [followupMsg, setFollowupMsg] = useState('');
  
  const [selectedAssignee, setSelectedAssignee] = useState(neutralDropdowns ? '' : (initialLead.assignedToId || ''));
  const [selectedStatus, setSelectedStatus] = useState(neutralDropdowns ? '' : (initialLead.lastLeadStatus || ''));

  async function handleAssign(userId) {
    setAssigning(true);
    setSelectedAssignee(userId);
    try {
      const res = await fetch('/api/manager/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, userId })
      });
      if (res.ok) {
        setLead({ ...lead, assignedToId: userId, assignedTo: users.find(u => u.id === userId) });
      } else {
        throw new Error('Failed to assign');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleRequestFollowup() {
    if (!selectedAssignee) return alert('Please select a user from the Assign To dropdown first.');
    if (!followupMsg.trim()) return alert('Please enter a message for the followup.');
    setAssigning(true);
    try {
      const res = await fetch('/api/manager/request-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, userId: selectedAssignee, message: followupMsg })
      });
      if (res.ok) {
        setLead({
          ...lead,
          assignedToId: selectedAssignee,
          assignedTo: users.find(u => u.id === selectedAssignee),
          followupRequestedAt: new Date().toISOString(),
          followupAcceptedAt: null,
          followupDeclinedAt: null,
          followupMessage: followupMsg
        });
        setShowFollowup(false);
      } else {
        throw new Error('Failed to request followup');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleStatusChange(statusValue) {
    setUpdating(true);
    setSelectedStatus(statusValue);
    try {
      const res = await fetch(`/api/manager/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastLeadStatus: statusValue })
      });
      if (res.ok) {
        const data = await res.json();
        setLead({ ...lead, lastLeadStatus: data.lastLeadStatus, status: data.status });
      } else {
        throw new Error('Failed to update status');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
      {/* Follow-up Status Badge */}
      {lead.followupRequestedAt && (
        <div className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between ${
          lead.followupAcceptedAt ? 'bg-emerald-50 text-emerald-700' :
          lead.followupDeclinedAt ? 'bg-rose-50 text-rose-700' :
          'bg-amber-50 text-amber-700'
        }`}>
          <div className="flex items-center gap-1.5">
            {lead.followupAcceptedAt ? <CheckCircle size={14} /> :
             lead.followupDeclinedAt ? <XCircle size={14} /> :
             <Clock size={14} className="animate-pulse" />}
            {lead.followupAcceptedAt ? 'Follow-up Accepted by ' + (lead.assignedTo?.name || 'User') :
             lead.followupDeclinedAt ? 'Follow-up Declined by ' + (lead.assignedTo?.name || 'User') :
             'Follow-up Pending Accept from ' + (lead.assignedTo?.name || 'User')}
          </div>
          <span className="opacity-70 font-medium">
            {formatDateTime(lead.followupAcceptedAt || lead.followupDeclinedAt || lead.followupRequestedAt)}
          </span>
        </div>
      )}

      {/* Name & Phone */}
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-slate-800">{lead.name || 'Unknown'}</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 mt-0.5">
            <Phone className="w-3.5 h-3.5" />
            <a href={`tel:${lead.phone}`} className="text-brand-600">{lead.phone}</a>
          </div>
          {lead.createdAt && (
            <div className="text-[10px] text-slate-400 mt-1">Added: {formatDateTime(lead.createdAt)}</div>
          )}
        </div>
        <div className="text-right">
          <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
            lead.lastLeadStatus === 'CONVERTED' ? 'bg-emerald-100 text-emerald-700' :
            lead.lastLeadStatus ? 'bg-brand-50 text-brand-600' :
            'bg-slate-100 text-slate-500'
          }`}>
            {lead.lastLeadStatus ? leadStatusCategoryLabel(lead.lastLeadStatus) : LEAD_STATUS_LABEL[lead.status] || 'Unassigned'}
          </span>
          {showCompany && lead.company && (
            <div className="text-[10px] text-slate-400 mt-1">{lead.company.name}</div>
          )}
        </div>
      </div>

      {/* Client Details from extraData */}
      {(lead.city || (lead.extraData && Object.keys(lead.extraData).length > 0)) && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Client Details</h4>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            {lead.city && (
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Location</span>
                <span className="font-semibold text-slate-700">{lead.city}</span>
              </div>
            )}
            {lead.extraData && Object.entries(lead.extraData).map(([key, val]) => (
              <div key={key}>
                <span className="text-slate-400 block text-[9px] uppercase">{key}</span>
                <span className="font-semibold text-slate-700">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead Journey Timeline */}
      {lead.dispositions && lead.dispositions.length > 0 && (
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Lead Journey</h4>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {lead.dispositions.map((disp, idx) => (
              <div key={idx} className="relative flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-400 mt-1 shrink-0 relative z-10 border-2 border-white shadow-sm" />
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-slate-700 flex justify-between items-start">
                    <span>{leadStatusCategoryLabel(disp.leadStatus)}</span>
                    <span className="text-[9px] font-semibold text-slate-400 text-right">{formatDateTime(disp.submittedAt)}</span>
                  </div>
                  <div className="text-[10px] font-semibold text-brand-600 mt-0.5">
                    by {disp.user?.name} {disp.user?.role === 'SITE_ENGINEER' ? '(Engineer)' : '(Telecaller)'}
                  </div>
                  {disp.notes && (
                    <div className="text-[11px] text-slate-600 mt-1.5 italic border-l-2 border-brand-200 pl-2">
                      &quot;{disp.notes}&quot;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions: Assign + Status */}
      <div className="pt-3 border-t border-slate-100">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Assign To</span>
            <div className="relative">
              <select
                disabled={assigning}
                value={selectedAssignee}
                onChange={(e) => handleAssign(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
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

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Update Status</span>
            <div className="relative">
              <select
                disabled={updating}
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="">-- Select --</option>
                {LEAD_STATUS_CATEGORY.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Immediate Follow-up Request UI */}
        {!showFollowup ? (
          <button
            onClick={() => setShowFollowup(true)}
            className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1.5"
          >
            <MessageSquare size={12} />
            Require Immediate Follow-up
          </button>
        ) : (
          <div className="mt-2 p-3 bg-brand-50 rounded-xl border border-brand-100">
            <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wide mb-1 block">What should they speak about?</label>
            <textarea
              value={followupMsg}
              onChange={e => setFollowupMsg(e.target.value)}
              placeholder="E.g. Ask them about the site visit tomorrow..."
              className="w-full text-xs p-2 rounded border border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-2 resize-none"
              rows={2}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFollowup(false)}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestFollowup}
                disabled={assigning || !selectedAssignee || !followupMsg.trim()}
                className="bg-brand-600 text-white text-[11px] font-bold px-3 py-1.5 rounded hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                Send Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
