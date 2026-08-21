import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { Users, Search, Phone } from 'lucide-react';
import { LEAD_STATUS_LABEL, leadStatusCategoryLabel } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Company Leads' };

export default async function ManagerLeadsPage({ searchParams }) {
  const user = await requireManager();
  const params = await searchParams || {};
  const q = params.q?.trim();
  const companyIdFilter = params.companyId || user.companyId;

  const companies = await prisma.company.findMany({
    where: user.companyId ? { id: user.companyId } : undefined,
    orderBy: { name: 'asc' }
  });

  const where = {};
  if (companyIdFilter) where.companyId = companyIdFilter;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } }
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true, name: true, phone: true, status: true, lastLeadStatus: true, updatedAt: true,
      assignedTo: { select: { name: true, role: true } }
    }
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-6 mt-2">
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
          <Users className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Leads Explorer</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recent 50 leads</p>
        </div>
      </div>

      <form className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
        {!user.companyId && (
          <select name="companyId" defaultValue={companyIdFilter || ''} className="input text-sm">
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input type="text" name="q" defaultValue={q} placeholder="Search name or phone..." className="input pl-9 text-sm" />
          </div>
          <button type="submit" className="btn-primary px-4 rounded-xl text-sm">Search</button>
        </div>
      </form>

      <div className="space-y-3 mt-4">
        {leads.length === 0 ? (
          <div className="text-center p-8 text-slate-400">No leads found.</div>
        ) : (
          leads.map(lead => (
            <div key={lead.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-800">{lead.name || 'Unknown'}</div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    <a href={`tel:${lead.phone}`} className="text-brand-600">{lead.phone}</a>
                  </div>
                </div>
                <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase text-right ${
                  lead.lastLeadStatus === 'CONVERTED' ? 'bg-emerald-100 text-emerald-700' :
                  lead.lastLeadStatus ? 'bg-brand-50 text-brand-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {lead.lastLeadStatus ? leadStatusCategoryLabel(lead.lastLeadStatus) : LEAD_STATUS_LABEL[lead.status] || 'Unassigned'}
                </span>
              </div>
              <div className="pt-3 border-t border-slate-50 flex justify-between items-center mt-1">
                <div className="text-[10px] text-slate-400 font-medium">
                  {formatDateTime(lead.updatedAt)}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {lead.assignedTo ? `Assigned to ${lead.assignedTo.name} (${lead.assignedTo.role === 'SITE_ENGINEER' ? 'Eng' : 'Call'})` : 'Unassigned'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
