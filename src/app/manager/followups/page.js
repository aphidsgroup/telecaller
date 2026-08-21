import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { Clock, Search } from 'lucide-react';
import ManagerLeadCard from '@/components/manager/ManagerLeadCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Follow-ups' };

export default async function ManagerFollowupsPage({ searchParams }) {
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

  const where = {
    status: { notIn: ['CLOSED', 'NEW'] },
    lastLeadStatus: { not: null }
  };
  
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
    take: 100,
    select: {
      id: true, name: true, phone: true, status: true, lastLeadStatus: true, updatedAt: true, assignedToId: true,
      company: { select: { name: true } },
      assignedTo: { select: { name: true, role: true } },
      dispositions: { 
        orderBy: { submittedAt: 'asc' }, 
        select: { notes: true, audioBase64: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } } 
      }
    }
  });

  // Serialize dates
  function serializeDisp(disp) {
    return {
      ...disp,
      submittedAt: disp.submittedAt instanceof Date ? disp.submittedAt.toISOString() : disp.submittedAt,
    };
  }

  function serializeLead(lead) {
    return {
      ...lead,
      updatedAt: lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : lead.updatedAt,
      dispositions: lead.dispositions ? lead.dispositions.map(serializeDisp) : [],
    };
  }

  const serializedLeads = leads.map(serializeLead);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-6 mt-2">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Follow-ups</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Leads in Progress</p>
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
        {serializedLeads.length === 0 ? (
          <div className="text-center p-8 text-slate-400">No active follow-ups found.</div>
        ) : (
          serializedLeads.map(lead => (
            <ManagerLeadCard key={lead.id} initialLead={lead} users={systemUsers} showCompany={!user.companyId} neutralDropdowns={true} />
          ))
        )}
      </div>
    </div>
  );
}
