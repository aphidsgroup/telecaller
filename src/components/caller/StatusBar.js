'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StatusBar({ user, online, pending, queue, onSync }) {
  const router = useRouter();
  const [stats, setStats] = useState(null);

  // Own-progress strip: a telecaller can see how they are doing today without
  // ever seeing anybody else's leads.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/telecaller/stats', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setStats(d);
        })
        .catch(() => null);
    load();
    const t = setInterval(load, 120000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [queue?.remaining, queue?.scheduled]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">Telecaller</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`chip ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
            title={online ? 'Connected' : 'No connection - updates are queued on this device'}
          >
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
          <button onClick={signOut} className="text-xs font-semibold text-slate-500 underline">
            Sign out
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
        <span>
          <strong className="text-slate-900">{queue?.remaining ?? 0}</strong> to work now
        </span>
        <span className="text-slate-300">|</span>
        <span>
          <strong className="text-slate-900">{queue?.scheduled ?? 0}</strong> follow-ups booked
        </span>
        {stats ? (
          <>
            <span className="text-slate-300">|</span>
            <span title="Leads you have logged today against your target">
              <strong className="text-slate-900">{stats.today}</strong>/{stats.target} today
            </span>
          </>
        ) : null}
        {pending > 0 ? (
          <button onClick={onSync} className="ml-auto chip bg-amber-100 text-amber-900">
            {pending} to sync - retry
          </button>
        ) : null}
      </div>
    </header>
  );
}
