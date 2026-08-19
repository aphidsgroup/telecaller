import { requireTelecaller } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';
import { recordCallClick } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireTelecaller();
  const { leadId, clientAt } = await readJson(req);
  const result = await recordCallClick({ userId: user.id, leadId, clientAt });
  return ok({ lead: result, callClickedAt: result.callClickedAt });
});
