import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { Clock, Search } from 'lucide-react';
import ManagerLeadCard from '@/components/manager/ManagerLeadCard';
import { DEAD_LEAD_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Follow-ups' };

export default async function AdminFollowupsPage({ searchParams }) {
  const user = await requireAdmin();
  const params = (await searchParams) || {};
  const q = params.q?.trim();
  const companyIdFilter = params.companyId || user.companyId;
  const startingFilter = params.starting || '';

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
    lastLeadStatus: { not: null, notIn: DEAD_LEAD_STATUSES },
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
    take: 250,
    select: {
      id: true, name: true, phone: true, status: true, lastLeadStatus: true,
      updatedAt: true, assignedToId: true, city: true, extraData: true,
      followupMessage: true, followupRequestedAt: true,
      followupAcceptedAt: true, followupDeclinedAt: true,
      company: { select: { name: true } },
      assignedTo: { select: { name: true, role: true } },
      dispositions: {
        orderBy: { submittedAt: 'asc' },
        select: { notes: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } }
      }
    }
  });

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

  let telecallerLeads = serializedLeads.filter(l => {
    const lastDisp = l.dispositions && l.dispositions[l.dispositions.length - 1];
    return !lastDisp || lastDisp.user?.role === 'TELECALLER';
  });

  if (startingFilter) {
    telecallerLeads = telecallerLeads.filter(l => l.extraData && l.extraData.Starting === startingFilter);
  }

  const STARTING_ORDER = { 'Immediately': 1, 'Within 1 month': 2, 'Within 3 months': 3, 'More than 3 months': 4 };

  telecallerLeads.sort((a, b) => {
    const aVal = (a.extraData && STARTING_ORDER[a.extraData.Starting]) ? STARTING_ORDER[a.extraData.Starting] : 99;
    const bVal = (b.extraData && STARTING_ORDER[b.extraData.Starting]) ? STARTING_ORDER[b.extraData.Starting] : 99;
    if (aVal !== bVal) return aVal - bVal;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const engineerLeads = serializedLeads.filter(l => {
    const lastDisp = l.dispositions && l.dispositions[l.dispositions.length - 1];
    return lastDisp && lastDisp.user?.role === 'SITE_ENGINEER';
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Follow-ups</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active leads in progress</p>
        </div>
      </div>

      <form className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-3">
        {!user.companyId && (
          <select name="companyId" defaultValue={companyIdFilter || ''} className="input text-sm">
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input type="text" name="q" defaultValue={q} placeholder="Search name or phone..." className="input pl-9 text-sm" />
        </div>
        <select name="starting" defaultValue={startingFilter || ''} className="input text-sm w-full md:w-auto md:min-w-[150px]">
          <option value="">All Starting Times</option>
          <option value="Immediately">Immediately</option>
          <option value="Within 1 month">Within 1 month</option>
          <option value="Within 3 months">Within 3 months</option>
          <option value="More than 3 months">More than 3 months</option>
        </select>
        <button type="submit" className="btn-primary px-4 rounded-xl text-sm">Search</button>
      </form>

      {serializedLeads.length === 0 ? (
        <div className="text-center p-12 text-slate-400">No active follow-ups found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Updated by Telecallers</h2>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">
                {telecallerLeads.length}
              </span>
            </div>
            {telecallerLeads.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-400 text-sm">
                No telecaller-updated leads
              </div>
            ) : (
              <div className="space-y-3">
                {telecallerLeads.map(lead => (
                  <ManagerLeadCard key={lead.id} initialLead={lead} users={systemUsers} showCompany={!user.companyId} neutralDropdowns={true} />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Updated by Site Engineers</h2>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-auto">
                {engineerLeads.length}
              </span>
            </div>
            {engineerLeads.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-400 text-sm">
                No site engineer-updated leads
              </div>
            ) : (
              <div className="space-y-3">
                {engineerLeads.map(lead => (
                  <ManagerLeadCard key={lead.id} initialLead={lead} users={systemUsers} showCompany={!user.companyId} neutralDropdowns={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
