import prisma from '@/lib/prisma';
import { clientMeta, sessionCookieOptions, signSession, verifyPassword, SESSION_COOKIE } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { ROLE } from '@/lib/constants';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const { email, password } = await readJson(req);
  if (!email || !password) return fail(400, 'Email and password are required');

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
    return fail(401, 'Incorrect email or password');
  }
  if (!user.isActive) return fail(403, 'This account has been deactivated. Ask your admin.');

  const meta = await clientMeta();
  const now = new Date();
  const loginSession = await prisma.loginSession.create({
    data: { userId: user.id, loginAt: now, lastSeenAt: now, ip: meta.ip, userAgent: meta.userAgent },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });

  const token = await signSession({
    userId: user.id,
    role: user.role,
    name: user.name,
    sessionId: loginSession.id,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());

  return ok({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    redirect: user.role === ROLE.ADMIN ? '/admin' : 
              user.role === ROLE.MANAGER ? '/manager' : 
              user.role === ROLE.SITE_ENGINEER ? '/engineer' : 
              '/caller',
  });
});
