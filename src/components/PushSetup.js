'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSetup() {
  const [state, setState] = useState('checking'); // checking | unsupported | unconfigured | off | on | denied
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState('unsupported');
        return;
      }
      const res = await fetch('/api/push/vapid').then((r) => r.json()).catch(() => null);
      if (!res?.ok || !res.publicKey) {
        setState('unconfigured');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const { publicKey } = await fetch('/api/push/vapid').then((r) => r.json());
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      setState('on');
    } catch (err) {
      console.warn('[push] enable failed', err);
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'checking' || state === 'on' || state === 'unsupported') return null;

  const copy = {
    unconfigured: 'Push notifications are not configured on the server yet.',
    denied: 'Notifications are blocked for this site. Enable them in your browser settings to get follow-up alerts.',
    off: 'Get alerted when a new lead is assigned or a follow-up falls due.',
  }[state];

  return (
    <div className="card mt-3 flex items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Notifications</p>
        <p className="text-xs text-slate-500">{copy}</p>
      </div>
      {state === 'off' ? (
        <button className="btn-primary shrink-0" onClick={enable} disabled={busy}>
          {busy ? 'Enabling...' : 'Turn on'}
        </button>
      ) : null}
    </div>
  );
}
