
import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { isValidPhone, normalisePhone } from '@/lib/format';
import { EVENT, IMPORT_SOURCE } from '@/lib/constants';
import { logEvent } from '@/lib/events';
import { distributePool } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireManager();
  const body = await readJson(req);

  const { companyId, phone, name, typeOfLead, locationArea, builtUpArea, funding, starting } = body;

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

  // Create the lead
  const extraData = {
    'Type of Lead': typeOfLead,
    'Location Area': locationArea,
    'Built-up Area': builtUpArea,
    'Funding': funding,
    'Starting': starting
  };

  // We should create a manual import log to attach this to, or just insert it directly
  // A manual import log per day per manager could be nice, but null is fine for individual manual leads
  const lead = await prisma.lead.create({
    data: {
      name: name || 'Unknown',
      phone: String(phone).trim(),
      phoneKey,
      city: locationArea || null,
      extraData,
      source: IMPORT_SOURCE.MANUAL,
      companyId: companyId || null,
      score: 50 // base score
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

