import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { Users, Search } from 'lucide-react';
import ManagerLeadCard from '@/components/manager/ManagerLeadCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Company Leads' };

export default async function ManagerLeadsPage({ searchParams }) {
  const user = await requireManager();
  const params = (await searchParams) || {};
  const q = params.q?.trim();
  const companyIdFilter = params.companyId || user.companyId;

  const [companies, systemUsers] = await Promise.all([
    prisma.company.findMany({
      where: user.companyId ? { id: user.companyId } : undefined,
      orderBy: { name: 'asc' }
    }),
    prisma.user.findMany({
      where: { 
        role: { in: ['TELECALLER', 'SITE_ENGINEER'] }, 
        isActive: true, 
        ...(user.companyId ? { companyId: user.companyId } : {})
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' }
    })
  ]);

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
      id: true, name: true, phone: true, status: true, lastLeadStatus: true, updatedAt: true, assignedToId: true,
      company: { select: { name: true } },
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
            <ManagerLeadCard key={lead.id} initialLead={lead} users={systemUsers} showCompany={!user.companyId} />
          ))
        )}
      </div>
    </div>
  );
}
