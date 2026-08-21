import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { EVENT, TERMINAL_LEAD_STATUSES } from '@/lib/constants';
import { logEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (req, ctx) => {
  const manager = await requireManager();
  const { id } = await ctx.params;
  const { lastLeadStatus } = await readJson(req);

  if (!lastLeadStatus) return fail(400, 'Status is required');

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return fail(404, 'Lead not found');

  if (manager.companyId && lead.companyId !== manager.companyId) {
    return fail(403, 'Lead not in your company');
  }

  let finalStatus = lead.status;
  if (TERMINAL_LEAD_STATUSES.includes(lastLeadStatus)) {
    finalStatus = 'CLOSED';
  } else if (lead.status === 'CLOSED') {
    finalStatus = lead.assignedToId ? 'ASSIGNED' : 'UNASSIGNED';
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { 
      lastLeadStatus,
      status: finalStatus
    }
  });

  await logEvent(null, {
    leadId: lead.id,
    userId: manager.id,
    type: EVENT.STATUS_UPDATED,
    meta: { previousStatus: lead.lastLeadStatus, newStatus: lastLeadStatus, byRole: 'MANAGER' }
  });

  return ok({ success: true, lastLeadStatus, status: finalStatus });
});
