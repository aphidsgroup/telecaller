import prisma from './prisma';
import { logEvent } from './events';
import { getSettings, bool, num, str } from './settings';
import { ASSIGNMENT_MODE, EVENT, HELD_STATUSES, LEAD_STATUS, ROLE } from './constants';

const LEAD_SELECT = {
  id: true, name: true, phone: true, altPhone: true, source: true, project: true,
  city: true, budget: true, notes: true, extraData: true, dateAdded: true, status: true, priority: true,
  score: true, isDnd: true, assignedToId: true, assignedAt: true, servedAt: true,
  callClickedAt: true, inProgressAt: true, lastContactedAt: true, followUpAt: true,
  attemptCount: true, lastCallCategory: true, lastLeadStatus: true, createdAt: true,
  flaggedForReview: true, flagReason: true,
  duplicates: { select: { id: true, importLog: { select: { spreadsheetId: true, sheetTab: true } } } }
};

/** Shape sent to the telecaller screen - plus the previous attempts for context. */
export async function serialiseLeadForCaller(lead) {
  if (!lead) return null;
  const history = await prisma.disposition.findMany({
    where: { leadId: lead.id },
    orderBy: { submittedAt: 'desc' },
    take: 5,
    select: {
      id: true, attemptNo: true, callCategory: true, leadStatus: true, notes: true,
      submittedAt: true, followUpAt: true, isOverride: true,
      user: { select: { name: true } },
    },
  });

  // Attach friendly sheet names to duplicates if possible
  const duplicateSources = [];
  if (lead.duplicates && lead.duplicates.length > 0) {
    const spreadsheetIds = lead.duplicates.map(d => d.importLog?.spreadsheetId).filter(Boolean);
    const sources = spreadsheetIds.length ? await prisma.sheetSource.findMany({
      where: { spreadsheetId: { in: spreadsheetIds } },
      select: { spreadsheetId: true, name: true }
    }) : [];
    const sourceMap = Object.fromEntries(sources.map(s => [s.spreadsheetId, s.name]));
    
    for (const dup of lead.duplicates) {
      if (dup.importLog?.spreadsheetId) {
        duplicateSources.push(sourceMap[dup.importLog.spreadsheetId] || dup.importLog.sheetTab || 'Unknown Sheet');
      } else {
        duplicateSources.push('Unknown Source');
      }
    }
  }

  return {
    ...lead,
    callClicked: lead.status === LEAD_STATUS.IN_PROGRESS,
    duplicateSources: [...new Set(duplicateSources)],
    history: history.map((h) => ({
      id: h.id,
      attemptNo: h.attemptNo,
      callCategory: h.callCategory,
      leadStatus: h.leadStatus,
      notes: h.notes,
      submittedAt: h.submittedAt.toISOString(),
      followUpAt: h.followUpAt ? h.followUpAt.toISOString() : null,
      isOverride: h.isOverride,
      by: h.user?.name || 'Unknown',
    })),
  };
}

/** The lead this telecaller is already holding, if any (survives app restarts). */
export function findHeldLead(userId) {
  return prisma.lead.findFirst({
    where: { assignedToId: userId, status: { in: HELD_STATUSES } },
    select: LEAD_SELECT,
    orderBy: { inProgressAt: 'asc' },
  });
}

function candidateOrder(now) {
  return (a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aDue = a.status === LEAD_STATUS.SCHEDULED ? 0 : 1;
    const bDue = b.status === LEAD_STATUS.SCHEDULED ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    if (aDue === 0) {
      return new Date(a.followUpAt || now).getTime() - new Date(b.followUpAt || now).getTime();
    }
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.assignedAt || a.createdAt).getTime() - new Date(b.assignedAt || b.createdAt).getTime();
  };
}

async function eligibleCandidates(userId, now) {
  const rows = await prisma.lead.findMany({
    where: {
      assignedToId: userId,
      OR: [
        { status: LEAD_STATUS.ASSIGNED },
        { status: LEAD_STATUS.SCHEDULED, followUpAt: { lte: now } },
      ],
    },
    select: LEAD_SELECT,
    take: 200,
  });
  return rows.sort(candidateOrder(now));
}

/** Open workload of a telecaller - used to balance round-robin distribution. */
function openQueueCount(userId) {
  return prisma.lead.count({
    where: {
      assignedToId: userId,
      status: { in: [LEAD_STATUS.ASSIGNED, LEAD_STATUS.ACTIVE, LEAD_STATUS.IN_PROGRESS, LEAD_STATUS.SCHEDULED] },
    },
  });
}

export async function queueSummary(userId) {
  const now = new Date();
  const [pending, scheduled, dueNow, worked12h, next] = await Promise.all([
    prisma.lead.count({ where: { assignedToId: userId, status: LEAD_STATUS.ASSIGNED } }),
    prisma.lead.count({ where: { assignedToId: userId, status: LEAD_STATUS.SCHEDULED } }),
    prisma.lead.count({ where: { assignedToId: userId, status: LEAD_STATUS.SCHEDULED, followUpAt: { lte: now } } }),
    prisma.disposition.count({
      where: { userId, submittedAt: { gte: new Date(now.getTime() - 12 * 3600000) } },
    }),
    prisma.lead.findFirst({
      where: { assignedToId: userId, status: LEAD_STATUS.SCHEDULED, followUpAt: { gt: now } },
      orderBy: { followUpAt: 'asc' },
      select: { followUpAt: true },
    }),
  ]);
  return {
    pending,
    scheduled,
    dueNow,
    worked12h,
    remaining: pending + dueNow,
    nextAt: next?.followUpAt || null,
  };
}

function ruleTargetFor(lead, rules) {
  const match = rules.find((r) => {
    const value = String(lead[r.field] || '').trim().toLowerCase();
    return value && value === String(r.matchValue).trim().toLowerCase();
  });
  return match ? match.userId : null;
}

function activeTelecallers() {
  return prisma.user.findMany({
    where: { role: ROLE.TELECALLER, isActive: true },
    select: { id: true, name: true, companyId: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Pushes unassigned pool leads out to telecallers.
 * RULES mode uses city/project/source rules first, then falls back to round
 * robin; ROUND_ROBIN balances by who currently holds the fewest open leads.
 */
export async function distributePool({ actorId = null, limit = 500, modeOverride = null } = {}) {
  const settings = await getSettings();
  const mode = modeOverride || str(settings, 'assignment.mode');
  if (mode === ASSIGNMENT_MODE.MANUAL) {
    return { assigned: 0, skipped: 0, mode, reason: 'Assignment mode is MANUAL' };
  }

  const callers = await activeTelecallers();
  if (!callers.length) return { assigned: 0, skipped: 0, mode, reason: 'No active telecallers' };

  const maxQueue = num(settings, 'assignment.maxQueuePerCaller');
  const loads = new Map();
  for (const c of callers) loads.set(c.id, await openQueueCount(c.id));

  const rules =
    mode === ASSIGNMENT_MODE.RULES
      ? await prisma.assignmentRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } })
      : [];

  const pool = await prisma.lead.findMany({
    where: { status: LEAD_STATUS.UNASSIGNED, assignedToId: null },
    orderBy: [{ priority: 'desc' }, { score: 'desc' }, { createdAt: 'asc' }],
    take: limit,
    select: { id: true, city: true, project: true, source: true, companyId: true },
  });

  let assigned = 0;
  let skipped = 0;

  for (const lead of pool) {
    let targetId = rules.length ? ruleTargetFor(lead, rules) : null;
    if (targetId) {
       const targetUser = callers.find(c => c.id === targetId);
       if (!targetUser || targetUser.companyId !== lead.companyId || (loads.get(targetId) ?? 0) >= maxQueue) {
         targetId = null;
       }
    }

    if (!targetId) {
      const free = callers
        .filter((c) => (loads.get(c.id) ?? 0) < maxQueue && c.companyId === lead.companyId)
        .sort((a, b) => (loads.get(a.id) ?? 0) - (loads.get(b.id) ?? 0));
      if (!free.length) {
        skipped += 1;
        continue;
      }
      targetId = free[0].id;
    }

    const res = await prisma.lead.updateMany({
      where: { id: lead.id, status: LEAD_STATUS.UNASSIGNED, assignedToId: null },
      data: { assignedToId: targetId, assignedAt: new Date(), status: LEAD_STATUS.ASSIGNED },
    });
    if (res.count !== 1) {
      skipped += 1;
      continue;
    }
    loads.set(targetId, (loads.get(targetId) ?? 0) + 1);
    assigned += 1;
    await logEvent(null, {
      leadId: lead.id,
      userId: actorId,
      type: EVENT.LEAD_ASSIGNED,
      meta: { to: targetId, mode, auto: !actorId },
    });
  }

  return { assigned, skipped, mode };
}

/** Last-resort top-up when one telecaller has run dry. */
async function pullOneFromPool(userId, settings) {
  if (!bool(settings, 'assignment.autoAssign')) return null;
  const mode = str(settings, 'assignment.mode');
  if (mode === ASSIGNMENT_MODE.MANUAL) return null;

  const load = await openQueueCount(userId);
  if (load >= num(settings, 'assignment.maxQueuePerCaller')) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
  let where = { status: LEAD_STATUS.UNASSIGNED, assignedToId: null, companyId: user?.companyId || null };
  if (mode === ASSIGNMENT_MODE.RULES) {
    const rules = await prisma.assignmentRule.findMany({ where: { isActive: true, userId } });
    if (rules.length) {
      where = { ...where, OR: rules.map((r) => ({ [r.field]: { equals: r.matchValue } })) };
    }
  }

  const candidates = await prisma.lead.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { score: 'desc' }, { createdAt: 'asc' }],
    take: 5,
    select: { id: true },
  });

  for (const c of candidates) {
    const res = await prisma.lead.updateMany({
      where: { id: c.id, status: LEAD_STATUS.UNASSIGNED, assignedToId: null },
      data: { assignedToId: userId, assignedAt: new Date(), status: LEAD_STATUS.ASSIGNED },
    });
    if (res.count === 1) {
      await logEvent(null, {
        leadId: c.id,
        type: EVENT.LEAD_ASSIGNED,
        meta: { to: userId, mode, auto: true },
      });
      return c.id;
    }
  }
  return null;
}

async function suppressDnd(lead) {
  const now = new Date();
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: LEAD_STATUS.CLOSED,
      closedAt: now,
      lastLeadStatus: 'DND_SUPPRESSED',
      flaggedForReview: true,
      flagReason: 'Number is on the DND registry - suppressed before dialling',
      flaggedAt: now,
    },
  });
  await logEvent(null, { leadId: lead.id, type: EVENT.DND_MARKED, meta: { auto: true } });
}

/**
 * THE core mechanic: hand the telecaller exactly one lead.
 * 1. a lead they are already holding always comes back first (survives a
 *    closed app, a dead network or a mid-call reload)
 * 2. otherwise the top eligible lead in their own queue is locked to them
 * 3. if their queue is empty, optionally top up from the central pool
 */
export async function serveCurrentLead(userId) {
  const settings = await getSettings();
  const held = await findHeldLead(userId);
  if (held) return { lead: held, resumed: true };

  const now = new Date();
  let candidates = await eligibleCandidates(userId, now);

  if (!candidates.length) {
    const pulled = await pullOneFromPool(userId, settings);
    if (pulled) candidates = await eligibleCandidates(userId, now);
  }

  const blockDnd = bool(settings, 'privacy.blockDnd');

  for (const candidate of candidates) {
    if (blockDnd && candidate.isDnd) {
      await suppressDnd(candidate);
      continue;
    }
    const res = await prisma.lead.updateMany({
      where: {
        id: candidate.id,
        assignedToId: userId,
        status: { in: [LEAD_STATUS.ASSIGNED, LEAD_STATUS.SCHEDULED] },
      },
      data: {
        status: LEAD_STATUS.ACTIVE,
        servedAt: candidate.servedAt || now,
        callClickedAt: null,
      },
    });
    if (res.count !== 1) continue; // somebody else moved it - try the next one

    await logEvent(null, {
      leadId: candidate.id,
      userId,
      type: EVENT.LEAD_SERVED,
      meta: { attempt: candidate.attemptCount + 1, wasScheduled: candidate.status === LEAD_STATUS.SCHEDULED },
    });
    const fresh = await prisma.lead.findUnique({ where: { id: candidate.id }, select: LEAD_SELECT });
    return { lead: fresh, resumed: false };
  }

  return { lead: null, resumed: false };
}

/** Admin action: (re)assign a lead, or send it back to the pool with toUserId=null. */
export async function assignLead({ leadId, toUserId, actorId, reason = null }) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, assignedToId: true, status: true },
  });
  if (!lead) return null;

  const wasHeld = HELD_STATUSES.includes(lead.status);
  const nextStatus =
    lead.status === LEAD_STATUS.SCHEDULED ? LEAD_STATUS.SCHEDULED : LEAD_STATUS.ASSIGNED;

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedToId: toUserId,
      assignedAt: new Date(),
      status: toUserId ? nextStatus : LEAD_STATUS.UNASSIGNED,
      // a lead taken off somebody mid-call must not stay "on screen"
      ...(wasHeld ? { callClickedAt: null, inProgressAt: null } : {}),
    },
    select: LEAD_SELECT,
  });

  await logEvent(null, {
    leadId,
    userId: actorId,
    type: toUserId
      ? lead.assignedToId
        ? EVENT.LEAD_REASSIGNED
        : EVENT.LEAD_ASSIGNED
      : EVENT.LEAD_UNASSIGNED,
    meta: { from: lead.assignedToId, to: toUserId, reason, tookFromScreen: wasHeld },
  });
  return updated;
}

export { LEAD_SELECT };
