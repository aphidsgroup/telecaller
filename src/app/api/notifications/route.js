import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { sentAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return ok({ items, unread });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const { id } = await readJson(req).catch(() => ({}));
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
  return ok();
});
