import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { ok, fail, readJson, route } from '@/lib/api';
import { LEAD_STATUS } from '@/lib/constants';

export const POST = route(async (req) => {
  await requireAdmin();
  const { leadId } = await readJson(req);
  if (!leadId) return fail(400, 'leadId required');
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      lastLeadStatus: null,
      status: LEAD_STATUS.UNASSIGNED,
      assignedToId: null,
      assignedAt: null,
    }
  });
  return ok({ lead });
});
