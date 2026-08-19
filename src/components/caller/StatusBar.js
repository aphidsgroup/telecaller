'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, WifiOff, RefreshCw, LogOut } from 'lucide-react';

export default function StatusBar({ user, online, pending, queue, onSync }) {
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/telecaller/stats', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (alive && d.ok) setStats(d); })
        .catch(() => null);
    load();
    const t = setInterval(load, 120000);
    return () => { alive = false; clearInterval(t); };
  }, [queue?.remaining, queue?.scheduled]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const pct = stats ? Math.min(100, Math.round((stats.today / stats.target) * 100)) : 0;

  return (
    <header className="sticky top-0 z-20 bg-slate-950 text-white shadow-lg">
      {/* Main row */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo + name */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/20 p-1 shrink-0">
            <img src="/icon.png" alt="Buildogram" className="h-full w-full object-contain" />
          </span>
          <div>
            <p className="text-sm font-bold text-white leading-none">{user.name}</p>
            <p className="text-[10px] font-semibold text-slate-400 leading-none mt-0.5 uppercase tracking-wider">Telecaller</p>
          </div>
        </div>

        {/* Right: online status + signout */}
        <div className="flex items-center gap-2">
          {pending > 0 ? (
            <button
              onClick={onSync}
              className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              {pending} to sync
            </button>
          ) : null}
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? 'Online' : 'Offline'}
          </span>
          <button onClick={signOut} className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats + progress strip */}
      <div className="border-t border-white/10 px-4 pb-3 pt-2">
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400 mb-2">
          <span>
            <span className="text-white text-sm font-black">{queue?.remaining ?? 0}</span> due now
          </span>
          <span className="text-slate-700">·</span>
          <span>
            <span className="text-white text-sm font-black">{queue?.scheduled ?? 0}</span> follow-ups
          </span>
          {stats ? (
            <>
              <span className="text-slate-700">·</span>
              <span className="ml-auto">
                <span className="text-white font-black">{stats.today}</span>/{stats.target} today
              </span>
            </>
          ) : null}
        </div>
        {/* Progress bar */}
        {stats ? (
          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : (
          <div className="h-1 w-full rounded-full bg-white/10" />
        )}
      </div>
    </header>
  );
}
