import prisma from './prisma';
import { logEvent } from './events';
import { HttpError } from './auth';
import { getSettings, num } from './settings';
import { computeFollowUp } from './schedule';
import { notifyUser, notifyAdmins } from './push';
import {
  CALL_CATEGORY,
  EVENT,
  LEAD_STATUS,
  LEAD_STATUS_CATEGORY,
  TERMINAL_LEAD_STATUSES,
  callCategoryLabel,
  leadStatusCategoryLabel,
} from './constants';

const CALL_CATEGORY_VALUES = CALL_CATEGORY.map((c) => c.value);
const LEAD_STATUS_VALUES = LEAD_STATUS_CATEGORY.map((c) => c.value);

/**
 * Step 2 of the telecaller flow. A browser cannot tell us whether the call
 * actually connected - all we can honestly record is that the dialler was
 * opened, at this instant, by this user.
 */
export async function recordCallClick({ userId, leadId, clientAt = null }) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, assignedToId: true, status: true, attemptCount: true, isDnd: true, phone: true },
  });
  if (!lead) throw new HttpError(404, 'Lead not found');
  if (lead.assignedToId !== userId) throw new HttpError(403, 'This lead is not assigned to you');
  if (lead.isDnd) throw new HttpError(409, 'This number is on the DND registry and must not be called');
  if (![LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS].includes(lead.status)) {
    throw new HttpError(409, 'This lead is no longer on your screen - refresh to get the current one');
  }

  const at = clientAt ? new Date(clientAt) : new Date();
  const already = lead.status === LEAD_STATUS.IN_PROGRESS;

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: LEAD_STATUS.IN_PROGRESS,
      callClickedAt: at,
      inProgressAt: already ? undefined : at,
      attemptCount: { increment: already ? 0 : 1 },
    },
    select: { id: true, callClickedAt: true, attemptCount: true, status: true },
  });

  await logEvent(null, {
    leadId,
    userId,
    type: EVENT.CALL_CLICKED,
    at,
    meta: { attempt: updated.attemptCount, redial: already },
  });

  return updated;
}

export async function recordWhatsAppClick({ userId, leadId }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true } });
  if (!lead) throw new HttpError(404, 'Lead not found');
  await logEvent(null, { leadId, userId, type: EVENT.WHATSAPP_CLICKED, meta: {} });
  return { ok: true };
}

function validateDisposition({ callCategory, leadStatus }) {
  if (!CALL_CATEGORY_VALUES.includes(callCategory)) throw new HttpError(400, 'Pick a valid call category');
  if (!LEAD_STATUS_VALUES.includes(leadStatus)) throw new HttpError(400, 'Pick a valid lead status');
}

/**
 * Steps 4 and 5: close out the current lead and free the telecaller to receive
 * the next one. Idempotent on clientEventId so an offline replay (or a double
 * tap on a flaky connection) can never write the same disposition twice.
 */
export async function submitDisposition({
  userId,
  leadId,
  clientEventId,
  callCategory,
  leadStatus,
  notes = '',
  audioBase64 = null,
  callClickedAt = null,
  queuedOffline = false,
  clientDetails = null,
}) {
  if (!clientEventId) throw new HttpError(400, 'Missing clientEventId (idempotency key)');
  validateDisposition({ callCategory, leadStatus });

  const existing = await prisma.disposition.findUnique({
    where: { clientEventId },
    select: { id: true, leadId: true, followUpAt: true },
  });
  if (existing) {
    return { duplicate: true, dispositionId: existing.id, leadId: existing.leadId, followUpAt: existing.followUpAt };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true, name: true, assignedToId: true, status: true, attemptCount: true,
      callClickedAt: true, inProgressAt: true,
    },
  });
  if (!lead) throw new HttpError(404, 'Lead not found');
  if (lead.assignedToId !== userId) throw new HttpError(403, 'This lead is not assigned to you');
  if (lead.status === LEAD_STATUS.CLOSED) throw new HttpError(409, 'This lead is already closed');

  // The status form only unlocks after the call button is pressed. If the click
  // happened while offline the client replays its own timestamp here.
  let clickAt = lead.callClickedAt;
  if (lead.status !== LEAD_STATUS.IN_PROGRESS) {
    if (!callClickedAt) {
      throw new HttpError(409, 'Press the Call button before submitting a status update');
    }
    clickAt = new Date(callClickedAt);
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: LEAD_STATUS.IN_PROGRESS,
        callClickedAt: clickAt,
        inProgressAt: lead.inProgressAt || clickAt,
        attemptCount: { increment: 1 },
      },
    });
    await logEvent(null, {
      leadId,
      userId,
      type: EVENT.CALL_CLICKED,
      at: clickAt,
      meta: { attempt: lead.attemptCount + 1, offlineReplay: true },
    });
  }

  const settings = await getSettings();
  const attemptNo = (await prisma.disposition.count({ where: { leadId } })) + 1;
  const { followUpAt, close, reason } = await computeFollowUp({
    callCategory,
    leadStatus,
    attemptCount: Math.max(attemptNo, lead.attemptCount || 1),
    settings,
  });

  const submittedAt = new Date();
  const responseSeconds = clickAt ? Math.round((submittedAt.getTime() - new Date(clickAt).getTime()) / 1000) : null;

  const disposition = await prisma.disposition.create({
    data: {
      leadId,
      userId,
      attemptNo,
      callCategory,
      leadStatus,
      notes: notes?.trim() || null,
      audioBase64,
      callClickedAt: clickAt,
      submittedAt,
      responseSeconds,
      followUpAt,
      queuedOffline,
      clientEventId,
    },
  });

  // Build client detail updates — only overwrite fields that were actually filled in
  const clientUpdate = {};
  if (clientDetails) {
    if (clientDetails.name) clientUpdate.name = clientDetails.name.trim();
    if (clientDetails.locationArea) clientUpdate.city = clientDetails.locationArea.trim();
    // Store rich details in extraData, merging with existing values
    const existingLead = await prisma.lead.findUnique({ where: { id: leadId }, select: { extraData: true } });
    const existingExtra = (existingLead?.extraData && typeof existingLead.extraData === 'object') ? existingLead.extraData : {};
    const newExtra = { ...existingExtra };
    if (clientDetails.typeOfLead) newExtra['Type of Lead'] = clientDetails.typeOfLead.trim();
    if (clientDetails.builtUpArea) newExtra['Built-up Area'] = clientDetails.builtUpArea.trim();
    if (clientDetails.funding) newExtra['Funding'] = clientDetails.funding;
    if (clientDetails.starting) newExtra['Starting'] = clientDetails.starting;
    clientUpdate.extraData = newExtra;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: close ? LEAD_STATUS.CLOSED : LEAD_STATUS.SCHEDULED,
      followUpAt,
      followUpNotifiedAt: null,
      closedAt: close ? submittedAt : null,
      lastContactedAt: submittedAt,
      lastCallCategory: callCategory,
      lastLeadStatus: leadStatus,
      inProgressAt: null,
      // a fresh disposition supersedes any stale-lead flag
      flaggedForReview: false,
      flagReason: null,
      flaggedAt: null,
      ...clientUpdate,
    },
  });

  await logEvent(null, {
    leadId,
    userId,
    type: EVENT.STATUS_UPDATED,
    at: submittedAt,
    meta: {
      callCategory,
      leadStatus,
      callCategoryLabel: callCategoryLabel(callCategory),
      leadStatusLabel: leadStatusCategoryLabel(leadStatus),
      responseSeconds,
      attemptNo,
      queuedOffline,
    },
  });

  if (close) {
    await logEvent(null, {
      leadId,
      userId,
      type: EVENT.LEAD_CLOSED,
      at: submittedAt,
      meta: { reason, outcome: leadStatus, converted: leadStatus === 'CONVERTED' },
    });
  } else {
    await logEvent(null, {
      leadId,
      userId,
      type: EVENT.FOLLOWUP_SCHEDULED,
      at: submittedAt,
      meta: { followUpAt, reason },
    });
  }

  if (leadStatus === 'CONVERTED' || leadStatus === 'SEND_SITE_VISIT') {
    await notifyAdmins({
      type: 'ADMIN_MSG',
      title: leadStatus === 'CONVERTED' ? 'Lead converted' : 'Site visit requested',
      body: `${lead.name} - ${leadStatusCategoryLabel(leadStatus)}`,
      url: `/admin/leads/${leadId}`,
    });
  }

  return {
    duplicate: false,
    dispositionId: disposition.id,
    leadId,
    followUpAt,
    closed: close,
    reason,
    responseSeconds,
  };
}

/** Admin override - appends a new history row, never rewrites an old one. */
export async function adminOverride({
  actorId,
  leadId,
  callCategory = null,
  leadStatus = null,
  notes = '',
  followUpAt = null,
  reopen = false,
  clearFlag = false,
  priority = null,
  isDnd = null,
}) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new HttpError(404, 'Lead not found');

  const data = {};
  const meta = {};

  if (leadStatus) {
    validateDisposition({ callCategory: callCategory || 'NOT_ANSWERED', leadStatus });
    const terminal = TERMINAL_LEAD_STATUSES.includes(leadStatus);
    data.lastLeadStatus = leadStatus;
    data.lastCallCategory = callCategory || lead.lastCallCategory;
    data.status = terminal ? LEAD_STATUS.CLOSED : LEAD_STATUS.SCHEDULED;
    data.closedAt = terminal ? new Date() : null;
    data.followUpAt = terminal ? null : followUpAt ? new Date(followUpAt) : lead.followUpAt || new Date();
    data.followUpNotifiedAt = null;
    meta.leadStatus = leadStatus;

    await prisma.disposition.create({
      data: {
        leadId,
        userId: actorId,
        attemptNo: (await prisma.disposition.count({ where: { leadId } })) + 1,
        callCategory: callCategory || lead.lastCallCategory || 'NOT_ANSWERED',
        leadStatus,
        notes: notes?.trim() || 'Admin override',
        submittedAt: new Date(),
        followUpAt: data.followUpAt,
        isOverride: true,
        clientEventId: `override-${leadId}-${Date.now()}`,
      },
    });
  }

  if (reopen) {
    data.status = lead.assignedToId ? LEAD_STATUS.ASSIGNED : LEAD_STATUS.UNASSIGNED;
    data.closedAt = null;
    data.followUpAt = followUpAt ? new Date(followUpAt) : null;
    data.followUpNotifiedAt = null;
    meta.reopened = true;
  } else if (followUpAt && !leadStatus) {
    data.followUpAt = new Date(followUpAt);
    data.status = LEAD_STATUS.SCHEDULED;
    data.followUpNotifiedAt = null;
    meta.followUpAt = followUpAt;
  }

  if (clearFlag) {
    data.flaggedForReview = false;
    data.flagReason = null;
    data.flaggedAt = null;
    data.slaBreachedAt = null;
    meta.flagCleared = true;
  }
  if (priority != null) {
    data.priority = Number(priority);
    meta.priority = Number(priority);
  }
  if (isDnd != null) {
    data.isDnd = Boolean(isDnd);
    meta.isDnd = Boolean(isDnd);
  }

  const updated = await prisma.lead.update({ where: { id: leadId }, data });

  await logEvent(null, {
    leadId,
    userId: actorId,
    type: reopen ? EVENT.LEAD_REOPENED : clearFlag && !leadStatus ? EVENT.FLAG_CLEARED : EVENT.ADMIN_OVERRIDE,
    meta: { ...meta, notes: notes || null },
  });

  return updated;
}

/**
 * Optional guard-rail from the brief: a lead sitting "in progress" with no
 * status submitted past the configured threshold gets flagged for the admin.
 * The lead is NOT released - it stays with the telecaller who has it open.
 */
export async function flagStaleInProgress() {
  const settings = await getSettings();
  const minutes = num(settings, 'sla.inProgressMinutes');
  if (!minutes || minutes <= 0) return { flagged: 0 };
  const cutoff = new Date(Date.now() - minutes * 60000);

  const stale = await prisma.lead.findMany({
    where: {
      status: LEAD_STATUS.IN_PROGRESS,
      inProgressAt: { lt: cutoff },
      flaggedForReview: false,
    },
    select: { id: true, name: true, assignedToId: true, inProgressAt: true, assignedTo: { select: { name: true } } },
    take: 200,
  });

  for (const lead of stale) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        flaggedForReview: true,
        flaggedAt: new Date(),
        flagReason: `No status update ${minutes}+ minutes after the call button was pressed`,
      },
    });
    await logEvent(null, {
      leadId: lead.id,
      userId: lead.assignedToId,
      type: EVENT.AUTO_FLAGGED,
      meta: { minutes, since: lead.inProgressAt },
    });
  }

  if (stale.length) {
    await notifyAdmins({
      type: 'SLA_ALERT',
      title: `${stale.length} lead(s) stuck in progress`,
      body: stale.slice(0, 3).map((l) => `${l.name} (${l.assignedTo?.name || 'unassigned'})`).join(', '),
      url: '/admin/leads?flagged=1',
    });
  }
  return { flagged: stale.length };
}

/** SLA: leads nobody has touched within N hours of upload. */
export async function scanSlaBreaches() {
  const settings = await getSettings();
  const hours = num(settings, 'sla.untouchedHours');
  if (!hours || hours <= 0) return { breached: 0 };
  const cutoff = new Date(Date.now() - hours * 3600000);

  const stale = await prisma.lead.findMany({
    where: {
      status: { in: [LEAD_STATUS.UNASSIGNED, LEAD_STATUS.ASSIGNED] },
      lastContactedAt: null,
      createdAt: { lt: cutoff },
      slaBreachedAt: null,
    },
    select: { id: true, name: true, assignedToId: true },
    take: 500,
  });

  for (const lead of stale) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { slaBreachedAt: new Date(), flaggedForReview: true, flagReason: `Untouched for over ${hours}h`, flaggedAt: new Date() },
    });
    await logEvent(null, { leadId: lead.id, type: EVENT.SLA_BREACH, meta: { hours } });
  }

  if (stale.length) {
    await notifyAdmins({
      type: 'SLA_ALERT',
      title: `SLA breach: ${stale.length} lead(s) untouched`,
      body: `No contact attempt within ${hours} hours of upload.`,
      url: '/admin/leads?flagged=1',
    });
  }
  return { breached: stale.length };
}

/** Ping telecallers whose scheduled callbacks have come due. */
export async function notifyDueFollowUps() {
  const now = new Date();
  const due = await prisma.lead.findMany({
    where: {
      status: LEAD_STATUS.SCHEDULED,
      followUpAt: { lte: now },
      followUpNotifiedAt: null,
      assignedToId: { not: null },
    },
    select: { id: true, name: true, assignedToId: true },
    take: 500,
  });

  const byUser = new Map();
  for (const lead of due) {
    if (!byUser.has(lead.assignedToId)) byUser.set(lead.assignedToId, []);
    byUser.get(lead.assignedToId).push(lead);
  }

  for (const [userId, leads] of byUser) {
    await notifyUser(userId, {
      type: 'FOLLOWUP_DUE',
      title: leads.length === 1 ? 'Follow-up due now' : `${leads.length} follow-ups due now`,
      body: leads.slice(0, 3).map((l) => l.name).join(', '),
      url: '/caller',
    });
  }

  if (due.length) {
    await prisma.lead.updateMany({
      where: { id: { in: due.map((l) => l.id) } },
      data: { followUpNotifiedAt: now },
    });
  }
  return { notified: due.length };
}
