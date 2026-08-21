import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Building2, Search, Phone, User, Calendar, MapPin, Play, Clock, CheckCircle, Activity, FileSpreadsheet } from 'lucide-react';
import ManagerLiveSearch from '@/components/manager/ManagerLiveSearch';
import ManagerSiteVisitsPipeline from '@/components/manager/ManagerSiteVisitsPipeline';
import ManagerLeadCard from '@/components/manager/ManagerLeadCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Manager Dashboard' };

export default async function ManagerDashboard() {
  const user = await getCurrentUser();
  const companyFilter = user.companyId ? { companyId: user.companyId } : undefined;

  const companies = await prisma.company.findMany({
    where: companyFilter,
    orderBy: { name: 'asc' },
  });

  const stats = await Promise.all(
    companies.map(async (company) => {
      const where = { companyId: company.id };
      const [total, unassigned, pendingCall, siteVisit, followup, converted] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { ...where, status: 'UNASSIGNED' } }),
        prisma.lead.count({ where: { ...where, status: 'ASSIGNED' } }),
        prisma.lead.count({ where: { ...where, lastLeadStatus: { in: ['SITE_VISIT_DONE', 'SEND_SITE_VISIT'] } } }),
        prisma.lead.count({ where: { ...where, OR: [{ lastLeadStatus: 'INTERESTED' }, { status: 'SCHEDULED' }] } }),
        prisma.lead.count({ where: { ...where, lastLeadStatus: 'CONVERTED' } }),
      ]);
      return { ...company, total, unassigned, pendingCall, siteVisit, followup, converted };
    })
  );

  const [
    siteVisitLeads,
    recentLeads,
    recentTelecallerDisps,
    recentEngineerDisps,
    users
  ] = await Promise.all([
    prisma.lead.findMany({
      where: { ...companyFilter, lastLeadStatus: { in: ['SITE_VISIT_DONE', 'SEND_SITE_VISIT'] }, status: { not: 'CLOSED' } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { 
        id: true, name: true, phone: true, lastLeadStatus: true, assignedToId: true,
        createdAt: true, updatedAt: true,
        dispositions: { orderBy: { submittedAt: 'asc' }, select: { notes: true, audioBase64: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } } }
      }
    }),
    prisma.lead.findMany({
      where: { source: 'MANUAL', status: 'NEW', lastContactedAt: null, ...companyFilter },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, name: true, phone: true, status: true, lastLeadStatus: true, createdAt: true, updatedAt: true, assignedToId: true,
        company: { select: { name: true } },
        assignedTo: { select: { name: true, role: true } },
        dispositions: { orderBy: { submittedAt: 'asc' }, select: { notes: true, audioBase64: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } } }
      }
    }),
    prisma.disposition.findMany({
      where: { user: { role: 'TELECALLER' }, lead: { ...companyFilter } },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      select: {
        lead: {
          select: {
            id: true, name: true, phone: true, status: true, lastLeadStatus: true, createdAt: true, updatedAt: true, assignedToId: true,
            lastContactedAt: true,
            company: { select: { name: true } },
            assignedTo: { select: { name: true, role: true } },
            dispositions: { orderBy: { submittedAt: 'asc' }, select: { notes: true, audioBase64: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } } }
          }
        }
      }
    }),
    prisma.disposition.findMany({
      where: { user: { role: 'SITE_ENGINEER' }, lead: { ...companyFilter } },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      select: {
        lead: {
          select: {
            id: true, name: true, phone: true, status: true, lastLeadStatus: true, createdAt: true, updatedAt: true, assignedToId: true,
            lastContactedAt: true,
            company: { select: { name: true } },
            assignedTo: { select: { name: true, role: true } },
            dispositions: { orderBy: { submittedAt: 'asc' }, select: { notes: true, audioBase64: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } } }
          }
        }
      }
    }),
    prisma.user.findMany({
      where: { role: { in: ['TELECALLER', 'SITE_ENGINEER'] }, isActive: true, ...companyFilter },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' }
    })
  ]);

  // Deduplicate leads from dispositions
  const extractUniqueLeads = (disps, limit) => {
    const map = new Map();
    disps.forEach(d => { if (!map.has(d.lead.id)) map.set(d.lead.id, d.lead); });
    return Array.from(map.values()).slice(0, limit);
  };

  const recentlyContactedByTelecaller = extractUniqueLeads(recentTelecallerDisps, 15);
  const recentlyContactedByEngineer = extractUniqueLeads(recentEngineerDisps, 15);

  // Serialize dates — Next.js App Router cannot pass Date objects to 'use client' components.
  // Prisma returns Date instances; we must convert them to ISO strings first.
  function serializeDisp(disp) {
    return {
      ...disp,
      submittedAt: disp.submittedAt instanceof Date ? disp.submittedAt.toISOString() : disp.submittedAt,
    };
  }
  function serializeLead(lead) {
    return {
      ...lead,
      createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : lead.createdAt,
      updatedAt: lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : lead.updatedAt,
      lastContactedAt: lead.lastContactedAt instanceof Date ? lead.lastContactedAt.toISOString() : lead.lastContactedAt,
      dispositions: lead.dispositions ? lead.dispositions.map(serializeDisp) : [],
    };
  }

  const serializedSiteVisitLeads = siteVisitLeads.map(serializeLead);
  const serializedRecentLeads = recentLeads.map(serializeLead);
  const serializedContactedByTelecaller = recentlyContactedByTelecaller.map(serializeLead);
  const serializedContactedByEngineer = recentlyContactedByEngineer.map(serializeLead);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-4 mt-2">
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Manager Overview</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Lead Insights</p>
        </div>
      </div>
        
      {/* Search Bar */}
      <div className="mb-6">
        <ManagerLiveSearch placeholder="Search leads by phone number or name..." />
      </div>

      {stats.map(s => (
        <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">{s.name}</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-black text-brand-600 leading-none">{s.total}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Total Leads</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-black text-emerald-600 leading-none">{s.converted}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Converted</span>
            </div>

            <div className="col-span-2 pt-3 border-t border-slate-50 grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-slate-700">{s.siteVisit}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Visits</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-slate-700">{s.followup}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Follow Up</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-amber-600">{s.unassigned + s.pendingCall}</span>
                <span className="text-[9px] font-bold text-amber-600/70 uppercase tracking-wider mt-0.5">Pending</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {stats.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 space-y-2">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 font-semibold">No companies assigned yet.</p>
        </div>
      )}

      <ManagerSiteVisitsPipeline initialLeads={serializedSiteVisitLeads} users={users} />

      {serializedContactedByEngineer.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Recently Updated by Site Engineer
          </h2>
          <div className="space-y-3">
            {serializedContactedByEngineer.map(lead => (
              <ManagerLeadCard key={lead.id} initialLead={lead} users={users} showCompany={!user.companyId} />
            ))}
          </div>
        </div>
      )}

      {serializedContactedByTelecaller.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Recently Updated by Telecaller
          </h2>
          <div className="space-y-3">
            {serializedContactedByTelecaller.map(lead => (
              <ManagerLeadCard key={lead.id} initialLead={lead} users={users} showCompany={!user.companyId} />
            ))}
          </div>
        </div>
      )}

      {serializedRecentLeads.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Recently Added (Not Contacted)</h2>
          <div className="space-y-3">
            {serializedRecentLeads.map(lead => (
              <ManagerLeadCard key={lead.id} initialLead={lead} users={users} showCompany={!user.companyId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
