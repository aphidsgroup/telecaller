import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { logEvent } from '@/lib/events';
import { scoreLead } from '@/lib/score';
import { normalisePhone } from '@/lib/format';
import { EVENT, LEAD_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Resolve a flagged duplicate: ignore it, merge its notes into the original, or
// deliberately create it as a separate lead.
export const POST = route(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { resolution } = await readJson(req);

  const hit = await prisma.duplicateHit.findUnique({ where: { id }, include: { existingLead: true } });
  if (!hit) return fail(404, 'Duplicate record not found');
  if (hit.resolution !== 'PENDING') return fail(409, 'This duplicate has already been resolved');

  let raw = {};
  try {
    raw = hit.rawRow ? JSON.parse(hit.rawRow) : {};
  } catch {
    raw = {};
  }

  if (resolution === 'MERGED_NOTES') {
    const stamp = new Date().toISOString().slice(0, 10);
    const addition = `[${stamp} re-upload] ${raw.notes || 'Row re-uploaded with no notes'}`;
    await prisma.lead.update({
      where: { id: hit.existingLeadId },
      data: { notes: [hit.existingLead.notes, addition].filter(Boolean).join('\n') },
    });
    await logEvent(null, {
      leadId: hit.existingLeadId,
      userId: admin.id,
      type: EVENT.ADMIN_OVERRIDE,
      meta: { mergedFromDuplicate: hit.id },
    });
  } else if (resolution === 'FORCED_NEW') {
    const created = await prisma.lead.create({
      data: {
        name: raw.name || hit.name || 'Unnamed lead',
        phone: hit.phone,
        phoneKey: normalisePhone(hit.phone),
        altPhone: raw.altPhone || null,
        source: raw.source || 'Duplicate override',
        project: raw.project || null,
        city: raw.city || null,
        budget: raw.budget || null,
        notes: raw.notes || null,
        score: scoreLead(raw),
        status: LEAD_STATUS.UNASSIGNED,
        sourceRow: hit.sourceRow,
      },
      select: { id: true },
    });
    await logEvent(null, {
      leadId: created.id,
      userId: admin.id,
      type: EVENT.LEAD_UPLOADED,
      meta: { forcedFromDuplicate: hit.id, originalLeadId: hit.existingLeadId },
    });
  } else if (resolution !== 'IGNORED') {
    return fail(400, 'Resolution must be IGNORED, MERGED_NOTES or FORCED_NEW');
  }

  const updated = await prisma.duplicateHit.update({
    where: { id },
    data: { resolution, resolvedAt: new Date() },
  });
  return ok({ duplicate: updated });
});
