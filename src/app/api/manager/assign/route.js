import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { EVENT } from '@/lib/constants';
import { logEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const manager = await requireManager();
  const { leadId, userId } = await readJson(req);

  if (!leadId) return fail(400, 'Lead ID required');

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return fail(404, 'Lead not found');

  // Must belong to manager's company if manager is scoped
  if (manager.companyId && lead.companyId !== manager.companyId) {
    return fail(403, 'Lead not in your company');
  }

  let updateData = { assignedToId: userId, assignedAt: new Date() };
  let newStatus = lead.status;

  if (userId) {
    // If it's going to a Site Engineer, we can move status to ASSIGNED
    // If it's going to a Telecaller, it's also ASSIGNED
    updateData.status = 'ASSIGNED';
    newStatus = 'ASSIGNED';
  } else {
    // Unassigning
    updateData.status = 'UNASSIGNED';
    newStatus = 'UNASSIGNED';
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: updateData
  });

  await logEvent(null, {
    leadId: lead.id,
    userId: manager.id,
    type: userId ? EVENT.LEAD_REASSIGNED : EVENT.LEAD_UNASSIGNED,
    meta: { previousAssigneeId: lead.assignedToId, newAssigneeId: userId }
  });

  return ok({ success: true, status: newStatus });
});
