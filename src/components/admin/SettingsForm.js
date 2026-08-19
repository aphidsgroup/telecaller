'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsForm({ settings, defs }) {
  const router = useRouter();
  const [values, setValues] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const groups = useMemo(() => {
    const map = new Map();
    defs.forEach((d) => {
      if (!map.has(d.group)) map.set(d.group, []);
      map.get(d.group).push(d);
    });
    return [...map.entries()];
  }, [defs]);

  const dirty = defs.some((d) => String(values[d.key] ?? '') !== String(settings[d.key] ?? ''));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const patch = Object.fromEntries(defs.map((d) => [d.key, values[d.key] ?? d.def]));
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not save');
      setMessage('Settings saved.');
      router.refresh();
    } catch (err) {
      setMessage(String(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {groups.map(([group, items]) => (
        <section key={group} className="card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{group}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((def) => (
              <div key={def.key} className={def.type === 'textarea' ? 'md:col-span-2' : ''}>
                <label className="label" htmlFor={def.key}>
                  {def.label}
                </label>
                {def.type === 'bool' ? (
                  <select
                    id={def.key}
                    className="input"
                    value={String(values[def.key] ?? def.def)}
                    onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
                  >
                    <option value="true">On</option>
                    <option value="false">Off</option>
                  </select>
                ) : def.type === 'select' ? (
                  <select
                    id={def.key}
                    className="input"
                    value={values[def.key] ?? def.def}
                    onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
                  >
                    {def.options.map((o) => (
                      <option key={o} value={o}>
                        {o.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                ) : def.type === 'textarea' ? (
                  <textarea
                    id={def.key}
                    rows={3}
                    className="input"
                    value={values[def.key] ?? def.def}
                    onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
                  />
                ) : (
                  <input
                    id={def.key}
                    type={def.type === 'number' ? 'number' : def.type === 'time' ? 'time' : 'text'}
                    className="input"
                    value={values[def.key] ?? def.def}
                    onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
                  />
                )}
                {def.help ? <p className="mt-1 text-xs text-slate-500">{def.help}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3">
        <button className="btn-primary shadow-lg" disabled={busy || !dirty}>
          {busy ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
        </button>
        {message ? <span className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow">{message}</span> : null}
      </div>
    </form>
  );
}
