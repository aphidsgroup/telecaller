import prisma from './prisma';

/**
 * Append a row to the lead timeline. Everything the admin dashboard shows as a
 * timestamp comes from here, so it is deliberately write-only - nothing in the
 * app ever updates or deletes a LeadEvent.
 */
export async function logEvent(client, { leadId, userId = null, type, meta = null, at = undefined }) {
  const db = client || prisma;
  return db.leadEvent.create({
    data: {
      leadId,
      userId,
      type,
      at,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}

export function parseMeta(event) {
  if (!event?.meta) return null;
  try {
    return JSON.parse(event.meta);
  } catch {
    return null;
  }
}

/** Admin-level audit entry for actions that are not tied to one lead. */
export async function logAudit({ userId = null, action, detail = null, ip = null }) {
  return prisma.auditLog.create({
    data: { userId, action, detail: detail ? JSON.stringify(detail) : null, ip },
  });
}
