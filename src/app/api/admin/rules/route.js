import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

const FIELDS = new Set(['city', 'project', 'source']);

export const POST = route(async (req) => {
  await requireAdmin();
  const { field, matchValue, userId, priority } = await readJson(req);
  if (!FIELDS.has(field)) return fail(400, 'Rule field must be city, project or source');
  if (!matchValue || !userId) return fail(400, 'Match value and telecaller are required');
  const rule = await prisma.assignmentRule.create({
    data: { field, matchValue: String(matchValue).trim(), userId, priority: Number(priority) || 0 },
  });
  return ok({ rule });
});

export const DELETE = route(async (req) => {
  await requireAdmin();
  const { id } = await readJson(req);
  await prisma.assignmentRule.delete({ where: { id } }).catch(() => null);
  return ok();
});
