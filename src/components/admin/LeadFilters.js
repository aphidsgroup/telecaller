'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { LEAD_STATUS_CATEGORY, LEAD_STATUS_LABEL } from '@/lib/constants';

const STATUSES = Object.keys(LEAD_STATUS_LABEL);

export default function LeadFilters({ params, telecallers, sources, projects, cities, companies = [] }) {
  const router = useRouter();
  const search = useSearchParams();
  const [q, setQ] = useState(params.q || '');

  function apply(patch) {
    const next = new URLSearchParams(search.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    next.delete('page');
    router.push(`/admin/leads?${next.toString()}`);
  }

  return (
    <form
      className="card grid gap-3 p-4 md:grid-cols-4 lg:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
    >
      <div className="md:col-span-2 lg:col-span-2">
        <label className="label">Search</label>
        <input
          className="input"
          placeholder="Name, phone, project or city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={params.status || ''} onChange={(e) => apply({ status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Telecaller</label>
        <select className="input" value={params.telecaller || ''} onChange={(e) => apply({ telecaller: e.target.value })}>
          <option value="">Everyone</option>
          <option value="none">Unassigned pool</option>
          {telecallers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Company</label>
        <select className="input" value={params.companyId || ''} onChange={(e) => apply({ companyId: e.target.value })}>
          <option value="">Any company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Disposition</label>
        <select className="input" value={params.leadStatus || ''} onChange={(e) => apply({ leadStatus: e.target.value })}>
          <option value="">Any outcome</option>
          {LEAD_STATUS_CATEGORY.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Source</label>
        <select className="input" value={params.source || ''} onChange={(e) => apply({ source: e.target.value })}>
          <option value="">Any source</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Project / site</label>
        <select className="input" value={params.project || ''} onChange={(e) => apply({ project: e.target.value })}>
          <option value="">Any project</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">City / area</label>
        <select className="input" value={params.city || ''} onChange={(e) => apply({ city: e.target.value })}>
          <option value="">Any city</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Uploaded from</label>
        <input type="date" className="input" value={params.from || ''} onChange={(e) => apply({ from: e.target.value })} />
      </div>
      <div>
        <label className="label">Uploaded to</label>
        <input type="date" className="input" value={params.to || ''} onChange={(e) => apply({ to: e.target.value })} />
      </div>
      <div className="flex items-end gap-2 md:col-span-2">
        <button type="submit" className="btn-primary">
          Search
        </button>
        <button
          type="button"
          className={`btn ${params.flagged === '1' ? 'bg-rose-600 text-white' : 'btn-ghost'}`}
          onClick={() => apply({ flagged: params.flagged === '1' ? '' : '1' })}
        >
          Needs review
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setQ('');
            router.push('/admin/leads');
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
