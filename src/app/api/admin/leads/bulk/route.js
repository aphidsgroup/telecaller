import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { assignLead } from '@/lib/queue';
import { notifyUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { leadIds, userId, action = 'assign', priority = 1 } = await readJson(req);
  if (!Array.isArray(leadIds) || !leadIds.length) return fail(400, 'Select at least one lead');

  if (action === 'assign') {
    for (const leadId of leadIds) {
      await assignLead({ leadId, toUserId: userId || null, actorId: admin.id, reason: 'Bulk assignment' });
    }
    if (userId) {
      await notifyUser(userId, {
        type: 'REASSIGNED',
        title: `${leadIds.length} lead(s) assigned to you`,
        body: 'Open the app to start calling.',
        url: '/caller',
      });
    }
    return ok({ updated: leadIds.length });
  }

  if (action === 'priority') {
    await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { priority: Number(priority) } });
    return ok({ updated: leadIds.length });
  }

  return fail(400, 'Unknown bulk action');
});
