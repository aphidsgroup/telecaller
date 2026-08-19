import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { adminOverride } from '@/lib/workflow';
import { assignLead } from '@/lib/queue';
import { notifyUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

export const GET = route(async (_req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      events: { orderBy: { at: 'asc' }, include: { user: { select: { name: true } } } },
      dispositions: { orderBy: { submittedAt: 'asc' }, include: { user: { select: { name: true } } } },
      importLog: true,
    },
  });
  if (!lead) return fail(404, 'Lead not found');
  return ok({ lead });
});

export const PATCH = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await readJson(req);

  if (body.action === 'assign') {
    const lead = await assignLead({
      leadId: id,
      toUserId: body.userId || null,
      actorId: admin.id,
      reason: body.reason || null,
    });
    if (!lead) return fail(404, 'Lead not found');
    if (body.userId) {
      await notifyUser(body.userId, {
        type: 'REASSIGNED',
        title: 'A lead was assigned to you',
        body: `${lead.name} - open the app to call.`,
        url: '/caller',
      });
    }
    return ok({ lead });
  }

  const lead = await adminOverride({
    actorId: admin.id,
    leadId: id,
    callCategory: body.callCategory ?? null,
    leadStatus: body.leadStatus ?? null,
    notes: body.notes ?? '',
    followUpAt: body.followUpAt ?? null,
    reopen: Boolean(body.reopen),
    clearFlag: Boolean(body.clearFlag),
    priority: body.priority ?? null,
    isDnd: body.isDnd ?? null,
  });
  return ok({ lead });
});
