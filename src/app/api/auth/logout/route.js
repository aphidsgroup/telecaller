import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const POST = route(async () => {
  const session = await getSession();
  if (session?.sessionId) {
    await prisma.loginSession
      .update({ where: { id: session.sessionId }, data: { logoutAt: new Date() } })
      .catch(() => null);
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return ok({ redirect: '/login' });
});
