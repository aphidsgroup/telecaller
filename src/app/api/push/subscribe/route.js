import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireUser();
  const { subscription, userAgent } = await readJson(req);
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return fail(400, 'Invalid push subscription payload');

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth, userAgent: userAgent || null },
    create: { userId: user.id, endpoint, p256dh, auth, userAgent: userAgent || null },
  });
  return ok();
});

export const DELETE = route(async (req) => {
  await requireUser();
  const { endpoint } = await readJson(req);
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return ok();
});
