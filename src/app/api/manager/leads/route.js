
import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { isValidPhone, normalisePhone } from '@/lib/format';
import { EVENT, IMPORT_SOURCE, TERMINAL_LEAD_STATUSES } from '@/lib/constants';
import { logEvent } from '@/lib/events';
import { distributePool } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireManager();
  const body = await readJson(req);

  const { companyId, phone, name, typeOfLead, locationArea, builtUpArea, funding, starting, status } = body;

  if (!phone || !isValidPhone(phone)) {
    return fail(400, 'Invalid or missing phone number');
  }

  const phoneKey = normalisePhone(phone);
  
  // Check if lead exists
  const existing = await prisma.lead.findFirst({
    where: { phoneKey },
    select: { id: true }
  });

  if (existing) {
    return fail(409, 'This phone number already exists in the system as a lead.');
  }

  let finalStatus = 'UNASSIGNED';
  let lastLeadStatus = null;
  
  if (status && status !== 'UNASSIGNED') {
    lastLeadStatus = status;
    if (TERMINAL_LEAD_STATUSES.includes(status)) {
      finalStatus = 'CLOSED';
    } else {
      // If it's a follow-up or something else, we could leave it UNASSIGNED for someone else to call,
      // or we can mark it as UNASSIGNED so it gets distributed, but with the lastLeadStatus intact.
      finalStatus = 'UNASSIGNED';
    }
  }

  // Create the lead
  const extraData = {
    'Type of Lead': typeOfLead,
    'Location Area': locationArea,
    'Built-up Area': builtUpArea,
    'Funding': funding,
    'Starting': starting
  };

  const lead = await prisma.lead.create({
    data: {
      name: name || 'Unknown',
      phone: String(phone).trim(),
      phoneKey,
      city: locationArea || null,
      extraData,
      source: IMPORT_SOURCE.MANUAL,
      companyId: companyId || null,
      score: 50,
      status: finalStatus,
      lastLeadStatus
    }
  });

  await logEvent(null, {
    leadId: lead.id,
    userId: user.id,
    type: EVENT.LEAD_UPLOADED,
    meta: { source: IMPORT_SOURCE.MANUAL, addedByRole: 'MANAGER' }
  });

  // Try to auto distribute it
  await distributePool({ actorId: user.id }).catch(() => null);

  return ok({ lead });
});

