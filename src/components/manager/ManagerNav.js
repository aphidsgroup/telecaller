
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, LogOut } from 'lucide-react';

export default function ManagerNav() {
  const pathname = usePathname();
  
  const navs = [
    { name: 'Dashboard', href: '/manager', icon: Home },
    { name: 'Add Lead', href: '/manager/add-lead', icon: PlusCircle },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-around items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {navs.map((n) => {
        const active = pathname === n.href;
        const Icon = n.icon;
        return (
          <Link key={n.name} href={n.href} className={"flex flex-col items-center p-2 rounded-xl transition-colors \"}>
            <Icon className={"h-6 w-6 mb-1 \"} />
            <span className="text-[10px] font-bold tracking-wide uppercase">{n.name}</span>
          </Link>
        );
      })}
      
      <button onClick={() => {
        document.cookie = 'bt_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        window.location.href = '/login';
      }} className="flex flex-col items-center p-2 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
        <LogOut className="h-6 w-6 mb-1" />
        <span className="text-[10px] font-bold tracking-wide uppercase">Log Out</span>
      </button>
    </div>
  );
}

