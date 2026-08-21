'use client';

import { LogOut, UserCircle } from 'lucide-react';

export default function ManagerHeader({ user }) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2 text-slate-700">
        <UserCircle className="h-6 w-6 text-slate-300" />
        <span className="text-sm font-bold">{user?.name || 'Manager'}</span>
      </div>
      
      <button 
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 transition-colors"
      >
        <span className="text-xs font-bold uppercase tracking-wide">Logout</span>
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  );
}
