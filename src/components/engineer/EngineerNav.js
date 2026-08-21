'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, LogOut } from 'lucide-react';

export default function EngineerNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[64px] bg-white border-t border-slate-100 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.05)] px-6 flex justify-around items-center z-40 sm:max-w-[480px] sm:mx-auto">
      <Link href="/engineer" className="flex flex-col items-center gap-1 min-w-[64px]">
        <div className={`p-1.5 rounded-xl transition-all ${pathname === '/engineer' ? 'bg-brand-50 text-brand-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
          <MapPin className="h-[22px] w-[22px]" strokeWidth={pathname === '/engineer' ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] font-bold ${pathname === '/engineer' ? 'text-brand-600' : 'text-slate-400'}`}>Visits</span>
      </Link>

      <button onClick={() => { fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '/login'); }} className="flex flex-col items-center gap-1 min-w-[64px]">
        <div className="p-1.5 rounded-xl transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50">
          <LogOut className="h-[22px] w-[22px]" strokeWidth={2} />
        </div>
        <span className="text-[10px] font-bold text-slate-400">Log Out</span>
      </button>
    </nav>
  );
}
