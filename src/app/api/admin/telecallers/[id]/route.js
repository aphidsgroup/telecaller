import prisma from '@/lib/prisma';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await readJson(req);

  const data = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.email != null) data.email = String(body.email).toLowerCase().trim();
  if (body.phone != null) data.phone = String(body.phone).trim() || null;
  if (body.isActive != null) data.isActive = Boolean(body.isActive);
  if (body.role != null) data.role = body.role;
  if (body.dailyTarget != null) data.dailyTarget = Number(body.dailyTarget) || 0;
  if (body.password) data.passwordHash = await hashPassword(String(body.password));
  if (body.companyId !== undefined) data.companyId = body.companyId || null;

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, dailyTarget: true, phone: true },
  });
  return ok({ user });
});

export const DELETE = route(async (req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  await prisma.user.delete({ where: { id } });
  return ok({ deleted: true });
});

