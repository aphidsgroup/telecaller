import { requireTelecaller, touchPresence } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { queueSummary, serialiseLeadForCaller, serveCurrentLead } from '@/lib/queue';
import { getSettings, str } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// The only way a telecaller ever receives lead data. Exactly one lead, or none.
export const GET = route(async () => {
  const user = await requireTelecaller();
  await touchPresence(user.id, user.sessionId);

  const { lead, resumed } = await serveCurrentLead(user.id);
  const [summary, settings] = await Promise.all([queueSummary(user.id), getSettings()]);

  return ok({
    lead: await serialiseLeadForCaller(lead),
    resumed,
    queue: summary,
    config: {
      timezone: str(settings, 'company.timezone'),
      whatsappTemplate: str(settings, 'whatsapp.brochureTemplate'),
    },
    serverTime: new Date().toISOString(),
  });
});
