'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayPhone, fillTemplate, formatDateTime, formatDuration, relativeTime, telHref, waHref } from '@/lib/format';
import {
  cacheCurrentLead,
  enqueueDisposition,
  flushQueue,
  newClientEventId,
  queueSize,
  readCachedLead,
} from '@/lib/offline-queue';
import LeadCard from './LeadCard';
import DispositionForm from './DispositionForm';
import StatusBar from './StatusBar';

import { Phone, PhoneOff, RefreshCw, Clock, WifiOff } from 'lucide-react';

const EMPTY_FORM = {
  callCategory: '', leadStatus: '', notes: '', audioBase64: '',
  clientName: '', locationArea: '', builtUpArea: '', typeOfLead: '', funding: '', starting: '', floor: '',
};

export default function CallerWorkspace({ user }) {
  const [lead, setLead] = useState(null);
  const [queue, setQueue] = useState({ pending: 0, dueNow: 0, scheduled: 0, remaining: 0 });
  const [config, setConfig] = useState({ timezone: 'Asia/Kolkata', whatsappTemplate: '' });
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [callClickedAt, setCallClickedAt] = useState(null);
  const [tick, setTick] = useState(0);
  const eventIdRef = useRef(newClientEventId());

  const clicked = Boolean(callClickedAt) || lead?.callClicked;

  const applyPayload = useCallback((data, { cache = true } = {}) => {
    setLead(data.lead || null);
    if (data.queue) setQueue(data.queue);
    if (data.config) setConfig(data.config);
    setForm(EMPTY_FORM);
    setCallClickedAt(data.lead?.callClicked ? data.lead.callClickedAt : null);
    eventIdRef.current = newClientEventId();
    if (cache) cacheCurrentLead(data.lead ? { lead: data.lead, queue: data.queue, config: data.config } : null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/telecaller/current-lead', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load your lead');
      applyPayload(data);
    } catch (err) {
      // Offline: fall back to the lead already in hand, never to a new one.
      const cached = readCachedLead();
      if (cached?.lead) {
        setLead(cached.lead);
        setQueue(cached.queue || {});
        setConfig(cached.config || {});
        setCallClickedAt(cached.lead.callClicked ? cached.lead.callClickedAt : null);
        setError('Working offline - showing the lead you already have.');
      } else {
        setError(navigator.onLine ? String(err.message) : 'You are offline. Reconnect to get your next lead.');
        setLead(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  const refreshPending = useCallback(async () => setPending(await queueSize()), []);

  const trySync = useCallback(async () => {
    const { flushed, lastResponse } = await flushQueue();
    await refreshPending();
    if (flushed > 0) {
      setToast({ kind: 'ok', text: `${flushed} offline update${flushed > 1 ? 's' : ''} synced.` });
      if (lastResponse?.lead !== undefined) applyPayload(lastResponse);
      else await load();
    }
  }, [applyPayload, load, refreshPending]);

  useEffect(() => {
    setOnline(navigator.onLine);
    load();
    refreshPending();
    const goOnline = () => { setOnline(true); trySync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const onSwMessage = (event) => {
      if (event.data?.type === 'FLUSH_OUTBOX') trySync();
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    const heartbeat = setInterval(() => {
      fetch('/api/auth/me', { cache: 'no-store' }).catch(() => null);
    }, 60000);
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      clearInterval(heartbeat);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  async function onCallClick() {
    if (!lead) return;
    const at = new Date().toISOString();
    setCallClickedAt(at);
    try {
      const res = await fetch('/api/telecaller/call-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, clientAt: at }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 409) {
          setToast({ kind: 'warn', text: data.error });
          await load();
          return;
        }
        throw new Error(data.error);
      }
      setLead((prev) => (prev ? { ...prev, callClicked: true, callClickedAt: at } : prev));
      cacheCurrentLead({ lead: { ...lead, callClicked: true, callClickedAt: at }, queue, config });
    } catch {
      setToast({ kind: 'warn', text: 'Call logged on this device - it will sync when you are back online.' });
    }
  }

  async function onWhatsApp() {
    if (!lead) return;
    fetch('/api/telecaller/whatsapp-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id }),
    }).catch(() => null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!lead || submitting) return;
    if (!clicked) {
      setToast({ kind: 'warn', text: 'Press the Call button before updating the status.' });
      return;
    }
    if (!form.leadStatus) {
      setToast({ kind: 'warn', text: 'Please choose a lead status.' });
      return;
    }

    setSubmitting(true);
    setError('');
    const payload = {
      leadId: lead.id,
      clientEventId: eventIdRef.current,
      callCategory: form.callCategory,
      leadStatus: form.leadStatus,
      notes: form.notes,
      audioBase64: form.audioBase64,
      callClickedAt: callClickedAt || lead.callClickedAt || null,
      clientDetails: {
        name: form.clientName || null,
        locationArea: form.locationArea || null,
        builtUpArea: form.builtUpArea || null,
        typeOfLead: form.typeOfLead || null,
        funding: form.funding || null,
        starting: form.starting || null,
        floor: form.floor || null,
      },
    };

    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await fetch('/api/telecaller/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not save the status update');
        setSubmitting(false);
        return;
      }
      const followUp = data.result?.followUpAt;
      setToast({
        kind: 'ok',
        text: data.result?.closed
          ? 'Lead closed. Next lead loaded.'
          : `Follow-up scheduled for ${formatDateTime(followUp, config.timezone)}.`,
      });
      applyPayload(data);
    } catch {
      await enqueueDisposition(payload);
      await refreshPending();
      cacheCurrentLead(null);
      setLead(null);
      setForm(EMPTY_FORM);
      setCallClickedAt(null);
      setToast({
        kind: 'warn',
        text: 'Saved on this device. It will sync automatically, and your next lead loads once you are back online.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const waMessage = useMemo(
    () => (lead ? fillTemplate(config.whatsappTemplate, lead) : ''),
    [config.whatsappTemplate, lead]
  );

  const elapsed = callClickedAt || lead?.callClickedAt
    ? Math.round((Date.now() - new Date(callClickedAt || lead.callClickedAt).getTime()) / 1000)
    : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-100">
      <StatusBar
        user={user}
        online={online}
        pending={pending}
        queue={queue}
        onSync={trySync}
      />

      {/* Toast — slides down from top */}
      {toast ? (
        <div className="px-4 pt-3 animate-slide-down">
          <div
            className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm ${
              toast.kind === 'ok'
                ? 'bg-emerald-900 text-emerald-100'
                : 'bg-amber-900 text-amber-100'
            }`}
          >
            <span className="mt-0.5">{toast.kind === 'ok' ? '✓' : '⚠'}</span>
            <span>{toast.text}</span>
          </div>
        </div>
      ) : null}

      <main className="flex-1 space-y-4 px-4 pb-40 pt-4">
        {loading ? (
          <LeadSkeleton />
        ) : lead ? (
          <>
            <LeadCard lead={lead} tz={config.timezone} />

            {/* Step 1 — Call */}
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-white">1</span>
                <p className="text-sm font-semibold text-slate-800">Make the call</p>
              </div>
              <div className="p-4 space-y-3">
                {/* Main call button with pulse ring */}
                <div className="relative">
                  {!clicked && (
                    <span className="absolute inset-0 rounded-xl bg-emerald-500/30 animate-pulse-ring pointer-events-none" />
                  )}
                  <a
                    href={telHref(lead.phone)}
                    onClick={onCallClick}
                    className={`btn w-full py-4 text-base font-bold ${clicked ? 'bg-slate-700 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    <Phone className="h-5 w-5" />
                    {clicked ? 'Call again' : `Call ${displayPhone(lead.phone)}`}
                  </a>
                </div>
                {lead.altPhone ? (
                  <a
                    href={telHref(lead.altPhone)}
                    onClick={onCallClick}
                    className="btn-ghost w-full"
                  >
                    <Phone className="h-4 w-4 text-slate-400" />
                    Alt: {displayPhone(lead.altPhone)}
                  </a>
                ) : null}
                {clicked ? (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800 font-medium">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Dialler opened {elapsed != null ? `${formatDuration(elapsed)} ago` : ''} — log what happened below.
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400">Tap Call above to unlock the log form.</p>
                )}
              </div>
            </div>

            <DispositionForm
              lead={lead}
              form={form}
              setForm={setForm}
              unlocked={Boolean(clicked)}
              submitting={submitting}
              error={error}
              onSubmit={onSubmit}
              waHref={waHref(lead.phone, waMessage)}
              onWhatsApp={onWhatsApp}
              tz={config.timezone}
            />
          </>
        ) : (
          <EmptyState online={online} pending={pending} queue={queue} onRefresh={load} />
        )}
      </main>
    </div>
  );
}

function LeadSkeleton() {
  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="border-l-4 border-slate-200 p-4 space-y-3">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="skeleton h-6 w-36" />
            <div className="skeleton h-4 w-28" />
          </div>
          <div className="space-y-1.5">
            <div className="skeleton h-5 w-14 rounded-full" />
            <div className="skeleton h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="skeleton h-2.5 w-16" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ online, pending, queue, onRefresh }) {
  if (pending > 0) {
    return (
      <div className="card space-y-4 p-6 text-center animate-fade-in">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
          <RefreshCw className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">Waiting to sync</p>
          <p className="mt-1 text-sm text-slate-500">
            {pending} update{pending > 1 ? 's are' : ' is'} saved on this device. Your next lead loads automatically once you are back online.
          </p>
        </div>
        <button className="btn-ghost mx-auto" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }
  if (!online) {
    return (
      <div className="card space-y-4 p-6 text-center animate-fade-in">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <WifiOff className="h-6 w-6 text-slate-500" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">You are offline</p>
          <p className="mt-1 text-sm text-slate-500">
            New leads are only handed out when you have a connection.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="card space-y-4 p-6 text-center animate-fade-in">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
        <Phone className="h-6 w-6 text-brand-500" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">No lead waiting</p>
        <p className="mt-1 text-sm text-slate-500">
          {queue?.scheduled
            ? `You have ${queue.scheduled} follow-up${queue.scheduled > 1 ? 's' : ''} booked for later.`
            : 'Your queue is empty. Your admin will assign more leads shortly.'}
        </p>
      </div>
      <button className="btn-primary mx-auto" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" /> Check again
      </button>
    </div>
  );
}

