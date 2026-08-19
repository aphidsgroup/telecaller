import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { ROLE } from './constants';

export const SESSION_COOKIE = 'bt_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // two weeks - telecallers stay logged in on their handset

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error('JWT_SECRET is missing or too short (set it in .env)');
  }
  return new TextEncoder().encode(value);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function signSession({ userId, role, name, sessionId }) {
  return new SignJWT({ role, name, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.sub,
      role: payload.role,
      name: payload.name,
      sessionId: payload.sessionId,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}

/** Session from the cookie - token claims only, no DB round trip. */
export async function getSession() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Full user record, re-checked against the DB (role changes take effect at once). */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, phone: true, dailyTarget: true, company: { select: { name: true } } },
  });
  if (!user || !user.isActive) return null;
  return { ...user, sessionId: session.sessionId };
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Not signed in');
  return user;
}

export async function requireRole(role) {
  const user = await requireUser();
  if (user.role !== role) throw new HttpError(403, 'You do not have access to this area');
  return user;
}

export const requireAdmin = () => requireRole(ROLE.ADMIN);
export const requireTelecaller = () => requireRole(ROLE.TELECALLER);

export async function touchPresence(userId, sessionId) {
  const now = new Date();
  const jobs = [prisma.user.update({ where: { id: userId }, data: { lastSeenAt: now } })];
  if (sessionId) {
    jobs.push(
      prisma.loginSession
        .update({ where: { id: sessionId }, data: { lastSeenAt: now } })
        .catch(() => null)
    );
  }
  await Promise.all(jobs);
}

export async function clientMeta() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent') || null,
  };
}
