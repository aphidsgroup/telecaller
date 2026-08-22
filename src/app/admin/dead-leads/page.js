import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { DEAD_LEAD_STATUSES } from '@/lib/constants';
import { formatDateTime, displayPhone } from '@/lib/format';
import { Trash2, Search } from 'lucide-react';
import DeadLeadsActions from './DeadLeadsActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dead Leads - Buildogram Admin' };

const PAGE_SIZE = 50;

const DEAD_LABEL = {
  NOT_INTERESTED: { label: 'Not Interested', cls: 'bg-slate-100 text-slate-600' },
  WRONG_NUMBER: { label: 'Wrong Number', cls: 'bg-rose-100 text-rose-700' },
  DUPLICATE: { label: 'Duplicate', cls: 'bg-amber-100 text-amber-700' },
  ORDER_GIVEN_TO_OTHER_COMPANY: { label: 'Order to Other Company', cls: 'bg-orange-100 text-orange-700' },
};

export default async function DeadLeadsPage({ searchParams }) {
  await requireAdmin();
  const params = (await searchParams) || {};
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() || '';
  const companyId = params.companyId || '';
  const statusFilter = params.deadStatus || '';

  const where = {
    lastLeadStatus: { in: statusFilter ? [statusFilter] : DEAD_LEAD_STATUSES },
    ...(companyId ? { companyId } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}),
  };

  const [leads, total, companies] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, phone: true, lastLeadStatus: true, updatedAt: true, createdAt: true,
        company: { select: { name: true } },
        assignedTo: { select: { name: true } },
        dispositions: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: { notes: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } }
        }
      }
    }),
    prisma.lead.count({ where }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = new URLSearchParams(Object.entries({ q, companyId, deadStatus: statusFilter }).filter(([, v]) => v));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center">
          <Trash2 className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Dead Leads</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Not interested, wrong numbers, duplicates and orders given elsewhere
          </p>
        </div>
      </div>

      <form className="card p-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input type="text" name="q" defaultValue={q} placeholder="Search name or phone..." className="input pl-9 w-full" />
        </div>
        <select name="companyId" defaultValue={companyId} className="input">
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="deadStatus" defaultValue={statusFilter} className="input">
          <option value="">All dead reasons</option>
          {DEAD_LEAD_STATUSES.map(s => (
            <option key={s} value={s}>{DEAD_LABEL[s]?.label || s}</option>
          ))}
        </select>
        <div className="flex gap-2 md:col-span-4">
          <button type="submit" className="btn-primary">Filter</button>
          <a href="/admin/dead-leads" className="btn-ghost">Reset</a>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full">{total} total dead leads</span>
        {DEAD_LEAD_STATUSES.map(s => (
          <a key={s} href={`/admin/dead-leads?deadStatus=${s}`}
            className={`font-semibold px-3 py-1 rounded-full hover:opacity-80 transition-opacity ${DEAD_LABEL[s]?.cls || 'bg-slate-100 text-slate-600'} ${statusFilter === s ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}>
            {DEAD_LABEL[s]?.label || s}
          </a>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Trash2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>No dead leads found.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Lead</th>
                <th className="th">Reason</th>
                <th className="th">Last note</th>
                <th className="th">Updated by</th>
                <th className="th">Date</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map(lead => {
                const lastDisp = lead.dispositions[0];
                const badge = DEAD_LABEL[lead.lastLeadStatus] || { label: lead.lastLeadStatus, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="font-semibold text-slate-900">{lead.name}</div>
                      <div className="text-xs font-mono text-slate-500">{displayPhone(lead.phone)}</div>
                      {lead.company && <div className="text-[10px] font-bold text-brand-600 uppercase tracking-wide mt-0.5">{lead.company.name}</div>}
                    </td>
                    <td className="td">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="td text-xs text-slate-600 max-w-xs">
                      {lastDisp?.notes ? <span className="italic line-clamp-2">&quot;{lastDisp.notes}&quot;</span> : <span className="text-slate-400">&mdash;</span>}
                    </td>
                    <td className="td text-xs text-slate-600">
                      {lastDisp?.user?.name || lead.assignedTo?.name || <span className="text-slate-400">&mdash;</span>}
                      {lastDisp?.user?.role && <div className="text-[10px] text-slate-400">{lastDisp.user.role === 'SITE_ENGINEER' ? 'Site Engineer' : 'Telecaller'}</div>}
                    </td>
                    <td className="td text-xs text-slate-500">{formatDateTime(lead.updatedAt)}</td>
                    <td className="td"><DeadLeadsActions leadId={lead.id} leadName={lead.name} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {pages} ({total} leads)</span>
          <div className="flex gap-2">
            {page > 1 && <a className="btn-ghost" href={`/admin/dead-leads?${qs}&page=${page - 1}`}>Previous</a>}
            {page < pages && <a className="btn-ghost" href={`/admin/dead-leads?${qs}&page=${page + 1}`}>Next</a>}
          </div>
        </div>
      )}
    </div>
  );
}
