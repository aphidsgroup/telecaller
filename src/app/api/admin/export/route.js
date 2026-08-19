import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { route } from '@/lib/api';
import { getSettings, bool, str } from '@/lib/settings';
import { callCategoryLabel, leadStatusCategoryLabel, LEAD_STATUS_LABEL } from '@/lib/constants';
import { displayPhone, formatDateTime, maskPhone, toCsv } from '@/lib/format';
import { logAudit } from '@/lib/events';

export const dynamic = 'force-dynamic';

function range(searchParams) {
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const gte = from ? new Date(`${from}T00:00:00.000Z`) : null;
  const lte = to ? new Date(`${to}T23:59:59.999Z`) : null;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

/**
 * CSV export (opens straight in Excel). Phone numbers are masked when the
 * privacy setting is on, and every export is written to the audit trail.
 */
export const GET = route(async (req) => {
  const admin = await requireAdmin();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'leads';
  const settings = await getSettings();
  const tz = str(settings, 'company.timezone');
  const mask = bool(settings, 'privacy.maskPhoneOnExport');
  const phoneOf = (p) => (mask ? maskPhone(p) : displayPhone(p));
  const createdAt = range(searchParams);

  let csv = '';
  let filename = 'export.csv';

  if (type === 'activity') {
    const rows = await prisma.disposition.findMany({
      where: createdAt ? { submittedAt: createdAt } : {},
      orderBy: { submittedAt: 'desc' },
      take: 20000,
      include: {
        user: { select: { name: true, email: true } },
        lead: { select: { name: true, phone: true, project: true, city: true, source: true } },
      },
    });
    csv = toCsv(rows, [
      { header: 'Submitted at', value: (r) => formatDateTime(r.submittedAt, tz) },
      { header: 'Telecaller', value: (r) => r.user?.name || '' },
      { header: 'Lead', value: (r) => r.lead?.name || '' },
      { header: 'Phone', value: (r) => phoneOf(r.lead?.phone) },
      { header: 'Project', value: (r) => r.lead?.project || '' },
      { header: 'City', value: (r) => r.lead?.city || '' },
      { header: 'Source', value: (r) => r.lead?.source || '' },
      { header: 'Attempt', value: (r) => r.attemptNo },
      { header: 'Call category', value: (r) => callCategoryLabel(r.callCategory) },
      { header: 'Lead status', value: (r) => leadStatusCategoryLabel(r.leadStatus) },
      { header: 'Call clicked at', value: (r) => formatDateTime(r.callClickedAt, tz) },
      { header: 'Seconds to log', value: (r) => r.responseSeconds ?? '' },
      { header: 'Follow-up at', value: (r) => formatDateTime(r.followUpAt, tz) },
      { header: 'Admin override', value: (r) => (r.isOverride ? 'Yes' : 'No') },
      { header: 'Queued offline', value: (r) => (r.queuedOffline ? 'Yes' : 'No') },
      { header: 'Notes', value: (r) => r.notes || '' },
    ]);
    filename = 'telecaller-activity.csv';
  } else {
    const rows = await prisma.lead.findMany({
      where: createdAt ? { createdAt } : {},
      orderBy: { createdAt: 'desc' },
      take: 20000,
      include: { assignedTo: { select: { name: true } } },
    });
    csv = toCsv(rows, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Phone', value: (r) => phoneOf(r.phone) },
      { header: 'Alternate phone', value: (r) => (r.altPhone ? phoneOf(r.altPhone) : '') },
      { header: 'Source', value: (r) => r.source || '' },
      { header: 'Project / site', value: (r) => r.project || '' },
      { header: 'City / area', value: (r) => r.city || '' },
      { header: 'Budget', value: (r) => r.budget || '' },
      { header: 'Status', value: (r) => LEAD_STATUS_LABEL[r.status] || r.status },
      { header: 'Last call category', value: (r) => (r.lastCallCategory ? callCategoryLabel(r.lastCallCategory) : '') },
      { header: 'Last lead status', value: (r) => (r.lastLeadStatus ? leadStatusCategoryLabel(r.lastLeadStatus) : '') },
      { header: 'Assigned to', value: (r) => r.assignedTo?.name || 'Unassigned' },
      { header: 'Attempts', value: (r) => r.attemptCount },
      { header: 'Score', value: (r) => r.score },
      { header: 'Uploaded at', value: (r) => formatDateTime(r.createdAt, tz) },
      { header: 'Assigned at', value: (r) => formatDateTime(r.assignedAt, tz) },
      { header: 'Last contacted at', value: (r) => formatDateTime(r.lastContactedAt, tz) },
      { header: 'Next follow-up', value: (r) => formatDateTime(r.followUpAt, tz) },
      { header: 'Closed at', value: (r) => formatDateTime(r.closedAt, tz) },
      { header: 'Flagged', value: (r) => (r.flaggedForReview ? r.flagReason || 'Yes' : '') },
      { header: 'DND', value: (r) => (r.isDnd ? 'Yes' : 'No') },
      { header: 'Notes', value: (r) => r.notes || '' },
    ]);
    filename = 'leads.csv';
  }

  // Exporting phone numbers is a privacy-relevant action - record who did it.
  await logAudit({
    userId: admin.id,
    action: 'EXPORT',
    detail: { type, masked: mask, from: searchParams.get('from'), to: searchParams.get('to') },
  });

  return new Response(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
