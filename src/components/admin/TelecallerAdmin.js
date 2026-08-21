'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE } from '@/lib/constants';

const BLANK = { name: '', email: '', phone: '', password: '', dailyTarget: 60, role: 'TELECALLER' };

export default function TelecallerAdmin() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  async function refresh() {
    const data = await fetch('/api/admin/telecallers').then((r) => r.json());
    if (data.ok) {
      setUsers(data.users);
      if (data.companies) setCompanies(data.companies);
    }
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
        <form onSubmit={create} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-6">
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
            <label className="label">Company</label>
            <select className="input" value={form.companyId || ''} onChange={(e) => setForm({ ...form, companyId: e.target.value || null })}>
              <option value="">(None)</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value={ROLE.TELECALLER}>Telecaller</option>
                <option value={ROLE.MANAGER}>Manager</option>
                <option value={ROLE.SITE_ENGINEER}>Site Engineer</option>
              </select>
            </div>
          <div>
            <label className="label">Password</label>
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
                className="input min-w-0"
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
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <span className={u.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}>{u.name}</span>
                {u.company ? (
                  <span className="chip bg-brand-50 text-brand-600 text-[10px]">{u.company.name}</span>
                ) : (
                  <span className="chip bg-slate-100 text-slate-500 text-[10px]">No company</span>
                )}
              </div>
              
              <div className="flex items-center gap-3 ml-auto text-xs font-semibold">
                <button
                  className="text-slate-500 hover:underline"
                  disabled={busy}
                  onClick={() => patch(u.id, { isActive: !u.isActive }, `${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}`)}
                >
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </button>
                  <select
                    className="bg-transparent text-slate-500 font-semibold focus:outline-none cursor-pointer"
                    value={u.role || ROLE.TELECALLER}
                    onChange={(e) => patch(u.id, { role: e.target.value }, `Changed role for ${u.name}`)}
                    disabled={busy}
                  >
                    <option value={ROLE.TELECALLER}>Telecaller</option>
                    <option value={ROLE.MANAGER}>Manager</option>
                    <option value={ROLE.SITE_ENGINEER}>Site Engineer</option>
                  </select>
                  <select
                    className="bg-transparent text-slate-500 font-semibold focus:outline-none cursor-pointer"
                    value={u.companyId || ''}
                  onChange={(e) => patch(u.id, { companyId: e.target.value || null }, `Assigned ${u.name} to company`)}
                  disabled={busy}
                >
                  <option value="">Set company...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  className="text-slate-500 hover:underline"
                  disabled={busy}
                  onClick={() => {
                    const email = window.prompt(`New email for ${u.name}`, u.email);
                    if (email && email.trim() !== u.email) patch(u.id, { email: email.trim() }, 'Email updated');
                  }}
                >
                  Change email
                </button>
                <button
                  className="text-slate-500 hover:underline"
                  disabled={busy}
                  onClick={() => {
                    const password = window.prompt(`New password for ${u.name} (min 6 characters)`);
                    if (password && password.length >= 6) patch(u.id, { password }, 'Password reset');
                  }}
                >
                  Reset password
                </button>
                <button
                  className="text-rose-500 hover:underline"
                  disabled={busy}
                  onClick={async () => {
                    if (window.confirm(`Are you sure you want to permanently delete ${u.name}? This will delete their past call logs too.`)) {
                      setBusy(true);
                      try {
                        const res = await fetch(`/api/admin/telecallers/${u.id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('Delete failed');
                        setMessage(`${u.name} deleted.`);
                        await refresh();
                      } catch (e) {
                        setMessage(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
