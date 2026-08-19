'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const BLANK = { name: '', email: '', phone: '', password: '', dailyTarget: 60 };

export default function TelecallerAdmin() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  async function refresh() {
    const data = await fetch('/api/admin/telecallers').then((r) => r.json());
    if (data.ok) setUsers(data.users);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/telecallers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not create the user');
      setMessage(`${data.user.name} can now sign in.`);
      setForm(BLANK);
      await refresh();
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function patch(id, body, note) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/telecallers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Update failed');
      setMessage(note);
      await refresh();
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Team accounts</h2>
          <p className="text-xs text-slate-500">Each telecaller needs their own login - shared accounts break attribution.</p>
        </div>
        <div className="flex items-center gap-3">
          {message ? <span className="text-xs font-medium text-brand-700">{message}</span> : null}
          <button className="btn-primary" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Add telecaller'}
          </button>
        </div>
      </div>

      {open ? (
        <form onSubmit={create} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-5">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Temp password</label>
            <input
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="label">Daily target</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="input"
                value={form.dailyTarget}
                onChange={(e) => setForm({ ...form, dailyTarget: e.target.value })}
              />
              <button className="btn-primary shrink-0" disabled={busy}>
                Add
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {users.length ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm">
              <span className={u.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}>{u.name}</span>
              <button
                className="text-xs font-semibold text-slate-500 underline"
                disabled={busy}
                onClick={() => patch(u.id, { isActive: !u.isActive }, `${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}`)}
              >
                {u.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                className="text-xs font-semibold text-slate-500 underline"
                disabled={busy}
                onClick={() => {
                  const password = window.prompt(`New password for ${u.name} (min 6 characters)`);
                  if (password && password.length >= 6) patch(u.id, { password }, 'Password reset');
                }}
              >
                Reset password
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
