import Link from 'next/link';
import prisma from '@/lib/prisma';
import LeadSearchBox from '@/components/admin/LeadSearchBox';
import BulkLeadAdder from '@/components/admin/BulkLeadAdder';
import LeadTable from '@/components/admin/LeadTable';
import { ROLE, DEAD_LEAD_STATUSES } from '@/lib/constants';
import { normalisePhone } from '@/lib/format';
import { getSettings, str } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Leads - Buildogram Admin' };

const PAGE_SIZE = 50;

function buildWhere(params) {
  const where = {};
  const q = (params.q || '').trim();
  if (q) {
    const digits = normalisePhone(q);
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      ...(digits ? [{ phoneKey: { contains: digits } }] : []),
      { project: { contains: q } },
      { city: { contains: q } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.companyId) where.companyId = params.companyId;
  if (params.telecaller === 'none') where.assignedToId = null;
  else if (params.telecaller) where.assignedToId = params.telecaller;
  if (params.source) where.source = params.source;
  if (params.project) where.project = params.project;
  if (params.city) where.city = params.city;
  if (params.flagged === '1') where.flaggedForReview = true;
  if (params.leadStatus) where.lastLeadStatus = { in: params.leadStatus.split(',') };
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: new Date(`${params.from}T00:00:00.000Z`) } : {}),
      ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999Z`) } : {}),
    };
  }
  return where;
}

export default async function LeadsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const page = Math.max(1, Number(params.page) || 1);
  const where = buildWhere(params);
  
  const settings = await getSettings();
  const tz = str(settings, 'company.timezone');

  // Only show fresh leads — not yet contacted (no disposition outcome set)
  const freshWhere = { ...where, lastLeadStatus: null };

  const [leads, total, systemUsers, sources, projects, cities, companies] = await Promise.all([
    prisma.lead.findMany({
      where: freshWhere,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { 
        assignedTo: { select: { id: true, name: true } }, 
        company: { select: { name: true } },
        dispositions: { orderBy: { submittedAt: 'asc' }, select: { notes: true, audioBase64: true, leadStatus: true, submittedAt: true, user: { select: { name: true, role: true } } } }
      },
    }),
    prisma.lead.count({ where: freshWhere }),
    prisma.user.findMany({
      where: { role: { in: ['TELECALLER', 'SITE_ENGINEER'] } },
      select: { id: true, name: true, role: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.lead.findMany({ distinct: ['source'], select: { source: true }, take: 60 }),
    prisma.lead.findMany({ distinct: ['project'], select: { project: true }, take: 60 }),
    prisma.lead.findMany({ distinct: ['city'], select: { city: true }, take: 60 }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  // Serialize dates for Client Components
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

  const serializedLeads = leads.map(serializeLead);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => v && k !== 'page').map(([k, v]) => [k, String(v)])
  );

  const telecallers = systemUsers.filter(u => u.role === 'TELECALLER');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            {total} fresh uncontacted lead{total === 1 ? '' : 's'} — contacted leads move to the Follow-ups tab automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <a className="btn-ghost" href={`/api/admin/export?type=leads${params.from ? `&from=${params.from}` : ''}${params.to ? `&to=${params.to}` : ''}`}>
            Export CSV
          </a>
        </div>
      </div>

      <LeadSearchBox
        params={params}
        companies={companies}
      />

      <BulkLeadAdder companies={companies} />

      {total > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Fresh Uncontacted Leads</h2>
          <LeadTable telecallers={telecallers} leads={serializedLeads} tz={tz} />
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link className="btn-ghost" href={`/admin/leads?${qs}&page=${page - 1}`}>
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link className="btn-ghost" href={`/admin/leads?${qs}&page=${page + 1}`}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
