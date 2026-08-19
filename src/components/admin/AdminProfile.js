'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminProfile({ user }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function patch(body, note) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/telecallers/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Update failed');
      setMessage(note);
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Admin Account</h2>
          <p className="text-xs text-slate-500">Update your login email and password.</p>
        </div>
        {message ? <span className="text-xs font-medium text-brand-700">{message}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm">
          <span className="text-slate-800 font-medium">{user.name}</span>
          <span className="text-slate-500">({user.email})</span>
          <button
            className="text-xs font-semibold text-slate-500 underline ml-2"
            disabled={busy}
            onClick={() => {
              const email = window.prompt(`New email for your admin account`, user.email);
              if (email && email.trim() !== user.email) patch({ email: email.trim() }, 'Admin email updated');
            }}
          >
            Change email
          </button>
          <button
            className="text-xs font-semibold text-slate-500 underline ml-2"
            disabled={busy}
            onClick={() => {
              const password = window.prompt(`New password for your admin account (min 6 characters)`);
              if (password && password.length >= 6) patch({ password }, 'Admin password reset');
            }}
          >
            Reset password
          </button>
        </div>
      </div>
    </section>
  );
}