import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { LEAD_STATUS } from '@/lib/constants';
import { normalisePhone, isValidPhone } from '@/lib/format';

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req);

  // Handle bulk assignment from the Leads table
  if (body.action === 'assign') {
    const { leadIds, userId } = body;
    if (!Array.isArray(leadIds) || !leadIds.length) {
      return fail(400, 'No leads selected');
    }

    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: {
        assignedToId: userId || null,
        status: userId ? LEAD_STATUS.ASSIGNED : LEAD_STATUS.UNASSIGNED,
        assignedAt: userId ? new Date() : null,
      }
    });

    const events = leadIds.map(leadId => ({
      leadId,
      userId: admin.id,
      type: userId ? 'LEAD_ASSIGNED' : 'LEAD_UNASSIGNED',
      meta: userId ? JSON.stringify({ assignedTo: userId }) : null
    }));
    
    if (events.length > 0) {
      await prisma.leadEvent.createMany({ data: events });
    }

    return ok({ updated: leadIds.length });
  }

  // Otherwise handle bulk addition via the BulkLeadAdder
  const { numbers, companyId } = body;
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return fail(400, 'No numbers provided');
  }

  let count = 0;
  for (const raw of numbers) {
    if (!isValidPhone(raw)) continue;
    const key = normalisePhone(raw);

    // Check if it already exists
    const exists = await prisma.lead.findFirst({ where: { phoneKey: key } });
    if (exists) continue;

    await prisma.lead.create({
      data: {
        name: 'Unknown',
        phone: raw,
        phoneKey: key,
        status: LEAD_STATUS.UNASSIGNED,
        source: 'Bulk Add',
        companyId: companyId || null,
      },
    });
    count++;
  }

  return ok({ count });
});
