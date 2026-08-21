'use client';

import { useState, useRef } from 'react';
import { MapPin, Phone, User, Calendar, CheckCircle, Navigation, Mic, Square, Trash2 } from 'lucide-react';
import fixWebmDuration from 'fix-webm-duration';
import { LEAD_STATUS_CATEGORY } from '@/lib/constants';

function AudioRecorder({ audioBase64, onAudioData, disabled }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const duration = Date.now() - startTimeRef.current;
        const initialBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        const blob = await new Promise(resolve => {
          fixWebmDuration(initialBlob, duration, (fixedBlob) => resolve(fixedBlob));
        });

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          onAudioData(reader.result);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      startTimeRef.current = Date.now();
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  if (audioBase64) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 border border-emerald-100">
        <audio src={audioBase64} controls className="h-8 max-w-[200px]" />
        <button
          type="button"
          onClick={() => onAudioData('')}
          className="p-2 text-rose-500 hover:bg-rose-100 rounded-full transition-colors"
          title="Delete Recording"
          disabled={disabled}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-2 rounded-lg bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 animate-pulse border border-rose-200 w-full justify-center"
        >
          <Square size={16} fill="currentColor" />
          Stop Recording...
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 border border-slate-200 disabled:opacity-50 w-full justify-center transition-colors"
        >
          <Mic size={16} />
          Record Voice Note
        </button>
      )}
    </div>
  );
}

export default function EngineerLeadCard({ lead, onUpdate, isUpdateMode = false }) {
  const [expanded, setExpanded] = useState(!isUpdateMode);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [audioBase64, setAudioBase64] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!status) return alert('Please select a status');
    
    setBusy(true);
    try {
      const res = await fetch('/api/engineer/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, leadStatus: status, notes, audioBase64 })
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
          {lead.followupAcceptedAt && lead.followupMessage && !isUpdateMode && (
            <div className="mb-2 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">Hot Transfer Note</p>
              <p className="text-xs text-rose-900 font-medium italic mt-0.5">&quot;{lead.followupMessage}&quot;</p>
            </div>
          )}
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

      {!expanded ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Last Updated Status</span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md inline-block mt-1 w-fit">
                {lead.lastLeadStatus ? lead.lastLeadStatus.replace(/_/g, ' ') : 'N/A'}
              </span>
            </div>
            {lead.updatedAt && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Time</span>
                <span className="text-xs font-medium text-slate-500 mt-1">
                  {new Date(lead.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setExpanded(true)}
            className="w-full bg-brand-50 text-brand-700 font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-brand-100 transition-colors"
          >
            Expand to Update Again
          </button>
        </div>
      ) : (
        <>
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

      {/* Telecaller Notes & Audio */}
      {(lead.dispositions?.[0]?.notes || lead.dispositions?.[0]?.audioBase64) && (
        <div className="mt-4 p-3 bg-brand-50 rounded-xl border border-brand-100">
          <h4 className="text-[10px] font-bold text-brand-600 uppercase tracking-wide mb-2">Telecaller Notes</h4>
          {lead.dispositions[0].notes && (
            <div className="text-xs text-slate-700 italic">
              &quot;{lead.dispositions[0].notes}&quot;
            </div>
          )}
          {lead.dispositions[0].audioBase64 && (
            <div className="mt-2">
              <audio src={lead.dispositions[0].audioBase64} controls className="h-8 max-w-[200px]" />
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">After Visit Status</label>
          <select 
            className="w-full mt-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            value={status} 
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">-- Select Status --</option>
            {LEAD_STATUS_CATEGORY.filter(s => ['SITE_VISIT_DONE', 'QUOTATION_SENT', 'NEGOTIATING', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED', 'COMING_TO_OFFICE'].includes(s.value)).map(s => (
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

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Voice Note (Optional)</label>
          <AudioRecorder audioBase64={audioBase64} onAudioData={setAudioBase64} disabled={busy} />
        </div>

        <button
          onClick={submit}
          disabled={busy || !status}
          className="w-full bg-brand-600 text-white font-bold text-sm px-4 py-3.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? 'Saving...' : isUpdateMode ? 'Update Status Again' : 'Save & Update Status'}
        </button>
      </div>
      </>
      )}
    </div>
  );
}
