'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost px-2.5 py-2"
      title="Sign out"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/login');
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4 text-slate-500" />
      <span className="hidden sm:inline text-sm text-slate-600">Sign out</span>
    </button>
  );
}
