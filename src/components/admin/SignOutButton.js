'use client';

import { useRouter } from 'next/navigation';

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="text-sm font-semibold text-slate-500 underline"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
