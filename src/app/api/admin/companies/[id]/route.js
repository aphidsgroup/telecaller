import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await readJson(req);

  const data = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;

  const company = await prisma.company.update({
    where: { id },
    data,
  });
  return ok({ company });
});

export const DELETE = route(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  await prisma.company.delete({ where: { id } });
  return ok({ deleted: true });
});
