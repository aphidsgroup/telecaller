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

const EMPTY_FORM = { callCategory: '', leadStatus: '', notes: '' };

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
    const goOnline = () => {
      setOnline(true);
      trySync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // The service worker pings us when the OS reports the connection is back.
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
    setCallClickedAt(at); // unlock the form immediately, even on a dead network
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
    if (!form.callCategory || !form.leadStatus) {
      setToast({ kind: 'warn', text: 'Choose both a call category and a lead status.' });
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
      callClickedAt: callClickedAt || lead.callClickedAt || null,
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
      cacheCurrentLead(null); // the held lead is done as far as this device knows
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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <StatusBar
        user={user}
        online={online}
        pending={pending}
        queue={queue}
        onSync={trySync}
      />

      <main className="flex-1 space-y-4 px-4 pb-40 pt-4">
        {toast ? (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
            }`}
          >
            {toast.text}
          </div>
        ) : null}

        {loading ? (
          <div className="card animate-pulse space-y-3 p-6">
            <div className="h-5 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-1/2 rounded bg-slate-200" />
            <div className="h-24 rounded bg-slate-100" />
          </div>
        ) : lead ? (
          <>
            <LeadCard lead={lead} tz={config.timezone} />

            <div className="card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1 - Call</p>
              <a
                href={telHref(lead.phone)}
                onClick={onCallClick}
                className="btn w-full bg-emerald-600 py-4 text-base text-white hover:bg-emerald-700"
              >
                Call {displayPhone(lead.phone)}
              </a>
              {lead.altPhone ? (
                <a
                  href={telHref(lead.altPhone)}
                  onClick={onCallClick}
                  className="btn-ghost mt-2 w-full"
                >
                  Try alternate {displayPhone(lead.altPhone)}
                </a>
              ) : null}
              {clicked ? (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Dialler opened at {formatDateTime(callClickedAt || lead.callClickedAt, config.timezone)}
                  {elapsed != null ? ` - ${formatDuration(elapsed)} ago` : ''}. The app cannot confirm whether the
                  call connected, so log what happened below.
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  The status form unlocks once you press Call.
                </p>
              )}
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

function EmptyState({ online, pending, queue, onRefresh }) {
  if (pending > 0) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-lg font-semibold text-slate-800">Waiting to sync</p>
        <p className="text-sm text-slate-600">
          {pending} status update{pending > 1 ? 's are' : ' is'} saved on this device. Your next lead loads
          automatically once you are back online.
        </p>
        <button className="btn-ghost mx-auto" onClick={onRefresh}>
          Try again
        </button>
      </div>
    );
  }
  if (!online) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-lg font-semibold text-slate-800">You are offline</p>
        <p className="text-sm text-slate-600">
          New leads are only handed out when you have a connection, so nobody works the same lead twice.
        </p>
      </div>
    );
  }
  return (
    <div className="card space-y-3 p-6 text-center">
      <p className="text-lg font-semibold text-slate-800">No lead waiting for you</p>
      <p className="text-sm text-slate-600">
        {queue?.scheduled
          ? `You have ${queue.scheduled} follow-up${queue.scheduled > 1 ? 's' : ''} booked for later${
              queue.nextAt ? ` (next ${relativeTime(queue.nextAt)})` : ''
            }.`
          : 'Your queue is empty. Your admin will assign more leads shortly.'}
      </p>
      <button className="btn-primary mx-auto" onClick={onRefresh}>
        Check again
      </button>
    </div>
  );
}
