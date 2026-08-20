import prisma from '@/lib/prisma';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { ROLE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({
    where: { role: { in: [ROLE.TELECALLER, ROLE.MANAGER] } },
    select: { id: true, name: true, email: true, isActive: true, dailyTarget: true, lastSeenAt: true, companyId: true, company: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  return ok({ users, companies });
});

export const POST = route(async (req) => {
  await requireAdmin();
  const { name, email, password, phone, role = ROLE.TELECALLER, dailyTarget = 60, companyId = null } = await readJson(req);
  if (!name || !email || !password) return fail(400, 'Name, email and password are required');
  if (String(password).length < 6) return fail(400, 'Password must be at least 6 characters');

  const normalised = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalised } });
  if (existing) return fail(409, 'A user with that email already exists');

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalised,
      phone: phone ? String(phone).trim() : null,
      role: [ROLE.ADMIN, ROLE.MANAGER, ROLE.TELECALLER].includes(role) ? role : ROLE.TELECALLER,
      dailyTarget: Number(dailyTarget) || 60,
      passwordHash: await hashPassword(String(password)),
      companyId: companyId || null,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, dailyTarget: true, companyId: true },
  });
  return ok({ user });
});
