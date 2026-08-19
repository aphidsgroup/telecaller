'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELDS = [
  { value: 'city', label: 'City / area' },
  { value: 'project', label: 'Project / site' },
  { value: 'source', label: 'Source' },
];

export default function RuleManager({ rules, telecallers }) {
  const router = useRouter();
  const [form, setForm] = useState({ field: 'city', matchValue: '', userId: '', priority: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function call(method, body) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/rules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="grid gap-2 md:grid-cols-5">
        <div>
          <label className="label">When</label>
          <select className="input" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
            {FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Equals</label>
          <input
            className="input"
            value={form.matchValue}
            onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
            placeholder="Chennai"
          />
        </div>
        <div>
          <label className="label">Assign to</label>
          <select className="input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">Choose telecaller</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <input
            type="number"
            className="input"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <button
            className="btn-primary w-full"
            disabled={busy || !form.matchValue || !form.userId}
            onClick={() => {
              call('POST', form);
              setForm({ ...form, matchValue: '' });
            }}
          >
            Add rule
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-rose-600">{message}</p> : null}

      {rules.length ? (
        <ul className="divide-y divide-slate-100">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">
                <strong className="capitalize">{r.field}</strong> = <strong>{r.matchValue}</strong> goes to{' '}
                <strong>{r.user?.name}</strong>
                <span className="ml-2 text-xs text-slate-400">priority {r.priority}</span>
              </span>
              <button className="text-xs font-semibold text-rose-600 underline" disabled={busy} onClick={() => call('DELETE', { id: r.id })}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No rules yet - leads are distributed by round robin.</p>
      )}
    </div>
  );
}
