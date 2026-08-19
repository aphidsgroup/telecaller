import { requireTelecaller } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';
import { recordWhatsAppClick } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireTelecaller();
  const { leadId } = await readJson(req);
  await recordWhatsAppClick({ userId: user.id, leadId });
  return ok();
});
