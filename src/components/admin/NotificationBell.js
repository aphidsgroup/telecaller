'use client';

import { useEffect, useRef, useState } from 'react';
import { relativeTime } from '@/lib/format';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  async function load() {
    try {
      const data = await fetch('/api/notifications', { cache: 'no-store' }).then((r) => r.json());
      if (data.ok) {
        setItems(data.items);
        setUnread(data.unread);
      }
    } catch {
      /* offline - keep whatever we already showed */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => {
      clearInterval(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setUnread(0);
      load();
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={toggle} className="relative rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" aria-label="Alerts">
        Alerts
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">Nothing to report.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id} className={`p-3 ${n.readAt ? '' : 'bg-brand-50/60'}`}>
                  <a href={n.url || '/admin'} className="block">
                    <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-600">{n.body}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{relativeTime(n.sentAt)}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
