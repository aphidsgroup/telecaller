
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Building2, TrendingUp, Clock, CheckCircle, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Manager Dashboard' };

export default async function ManagerDashboard() {
  const user = await getCurrentUser();

  // Fetch companies this manager can see
  const companies = await prisma.company.findMany({
    where: user.companyId ? { id: user.companyId } : undefined,
    orderBy: { name: 'asc' },
  });

  // Aggregate stats per company using raw counts (no groupBy _count issue)
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-6 mt-2">
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Manager Overview</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Lead Insights</p>
        </div>
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
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Site Visits</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold text-slate-700">{s.followup}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Follow Ups</span>
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
          <p className="text-xs text-slate-400">Ask your admin to assign this manager account to a company.</p>
        </div>
      )}
    </div>
  );
}
