'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building, Image as ImageIcon, Users, PhoneCall, Plus } from 'lucide-react';

export default function CompanyAdmin({ initialCompanies }) {
  const router = useRouter();
  const [companies, setCompanies] = useState(initialCompanies);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const res = await fetch('/api/admin/companies');
    const data = await res.json();
    if (res.ok) setCompanies(data.companies);
    router.refresh();
  };

  const createCompany = async (e) => {
    e.preventDefault();
    const name = window.prompt('Company Name:');
    if (!name) return;
    
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create company');
      setMessage('Company created successfully');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateCompany = async (id, field, promptText) => {
    const value = window.prompt(promptText);
    if (value === null) return;

    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Failed to update company');
      setMessage('Company updated');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteCompany = async (id, name) => {
    if (!window.confirm(`Delete ${name}? All associated leads and users will lose their company assignment (but won't be deleted).`)) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/companies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete company');
      setMessage('Company deleted');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 font-medium">{message}</div>
      ) : null}
      
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={createCompany} disabled={busy}>
          <Plus className="h-4 w-4" /> Add Company
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map(c => (
          <div key={c.id} className="card p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt={c.name} className="h-10 w-10 rounded-md object-cover border border-slate-200" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-brand-50 flex items-center justify-center border border-brand-100 text-brand-500">
                    <Building className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{c.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{c.description || 'No description'}</p>
                </div>
              </div>

              <div className="flex gap-4 mb-5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Telecallers</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-700 mt-1">
                    <Users className="h-4 w-4 text-slate-400" /> {c._count.users}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Leads</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-700 mt-1">
                    <PhoneCall className="h-4 w-4 text-slate-400" /> {c._count.leads}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
              <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => updateCompany(c.id, 'name', 'New Name:')}>Rename</button>
              <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => updateCompany(c.id, 'description', 'New Description:')}>Desc</button>
              <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => updateCompany(c.id, 'logoUrl', 'Logo Image URL:')}>Logo</button>
              <button className="text-xs font-semibold text-rose-500 hover:underline ml-auto" onClick={() => deleteCompany(c.id, c.name)}>Delete</button>
            </div>
          </div>
        ))}

        {companies.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No companies created yet.
          </div>
        )}
      </div>
    </div>
  );
}
