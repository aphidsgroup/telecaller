import prisma from '@/lib/prisma';
import { requireEngineer } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { submitDisposition } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireEngineer();

  const leads = await prisma.lead.findMany({
    where: { assignedToId: user.id },
    orderBy: { assignedAt: 'desc' },
  });

  return ok({ leads });
});

export const POST = route(async (req) => {
  const user = await requireEngineer();
  const body = await readJson(req);

  const { leadId, leadStatus, notes } = body;

  if (!leadId || !leadStatus) return fail(400, 'Missing fields');

  // Verify the lead belongs to this engineer
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.assignedToId !== user.id) {
    return fail(403, 'Lead not assigned to you');
  }

  // Submit the disposition
  const result = await submitDisposition({
    userId: user.id,
    leadId,
    clientEventId: `engineer_visit_${Date.now()}_${Math.random()}`,
    callCategory: 'SITE_VISIT_OUTCOME',
    leadStatus,
    notes: notes || 'Updated by Site Engineer',
    queuedOffline: false,
  });

  return ok({ result });
});
