import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { Clock, Search } from 'lucide-react';
import ManagerLeadCard from '@/components/manager/ManagerLeadCard';
import { DEAD_LEAD_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Company Follow-ups' };

export default async function ManagerFollowupsPage({ searchParams }) {
  const user = await requireManager();
  const params = (await searchParams) || {};
  const q = params.q?.trim() || '';
  const companyIdFilter = params.companyId || user.companyId || '';
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
    lastLeadStatus: { not: null, notIn: DEAD_LEAD_STATUSES }
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
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Follow-ups</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Leads in Progress</p>
        </div>
      </div>

      {/* Search bar — separate form, preserves current filter values */}
      <form method="GET" className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3">
        <input type="hidden" name="companyId" value={companyIdFilter} />
        <input type="hidden" name="starting" value={startingFilter} />
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name or phone..."
            className="input pl-9 text-sm w-full"
          />
        </div>
        <button type="submit" className="btn-primary px-4 rounded-xl text-sm">Search</button>
      </form>

      {/* Filters — auto-apply on change, preserves search query */}
      <form method="GET" className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center">
        <input type="hidden" name="q" value={q} />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Filter by:</span>
        {!user.companyId && (
          <select
            name="companyId"
            defaultValue={companyIdFilter}
            onChange="this.form.submit()"
            className="input text-sm py-2"
          >
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select
          name="starting"
          defaultValue={startingFilter}
          onChange="this.form.submit()"
          className="input text-sm py-2"
        >
          <option value="">All Starting Times</option>
          <option value="Immediately">🔴 Immediately</option>
          <option value="Within 1 month">🟠 Within 1 month</option>
          <option value="Within 3 months">🟡 Within 3 months</option>
          <option value="More than 3 months">🟢 More than 3 months</option>
        </select>
        {(companyIdFilter || startingFilter) && (
          <a href="/manager/followups" className="text-xs font-bold text-slate-400 hover:text-slate-600 underline">
            Clear filters
          </a>
        )}
      </form>

      {serializedLeads.length === 0 ? (
        <div className="text-center p-8 text-slate-400">No active follow-ups found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Updated by Telecallers</h2>
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">{telecallerLeads.length}</span>
            </div>
            {telecallerLeads.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-400 text-sm">No telecaller-updated leads</div>
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
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-auto">{engineerLeads.length}</span>
            </div>
            {engineerLeads.length === 0 ? (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 text-slate-400 text-sm">No site engineer-updated leads</div>
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
