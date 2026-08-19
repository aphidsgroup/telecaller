import webpush from 'web-push';
import prisma from './prisma';
import { getSettings, bool } from './settings';
import { ROLE } from './constants';

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  configured = true;
  return true;
}

export const pushConfigured = () => ensureConfigured();

/**
 * Records an in-app notification and, when web push is set up, delivers it to
 * every device the user has installed the PWA on. Push failures never break the
 * calling workflow - the in-app inbox is the source of truth.
 */
export async function notifyUser(userId, { type, title, body, url = '/' }) {
  const settings = await getSettings();
  const record = await prisma.notification.create({
    data: { userId, type, title, body, url },
  });

  if (!bool(settings, 'push.enabled') || !ensureConfigured()) return record;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return record;

  const payload = JSON.stringify({ title, body, url, type, id: record.id });
  let delivered = false;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        delivered = true;
      } catch (err) {
        // 404/410 mean the browser dropped the subscription - clean it up.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
        } else {
          console.warn('[push] send failed', err?.statusCode || err?.message);
        }
      }
    })
  );

  if (delivered) {
    await prisma.notification.update({ where: { id: record.id }, data: { pushOk: true } });
  }
  return record;
}

export async function notifyAdmins(payload) {
  const admins = await prisma.user.findMany({
    where: { role: ROLE.ADMIN, isActive: true },
    select: { id: true },
  });
  return Promise.all(admins.map((a) => notifyUser(a.id, payload)));
}

export async function notifyNewAssignments(countsByUser) {
  const jobs = [];
  for (const [userId, count] of Object.entries(countsByUser)) {
    if (!count) continue;
    jobs.push(
      notifyUser(userId, {
        type: 'NEW_LEAD',
        title: count === 1 ? 'New lead assigned' : `${count} new leads assigned`,
        body: 'Open the app to start calling.',
        url: '/caller',
      })
    );
  }
  return Promise.all(jobs);
}
