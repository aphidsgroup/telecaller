import { requireAdmin } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';
import { distributePool } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req).catch(() => ({}));
  const result = await distributePool({ actorId: admin.id, modeOverride: body?.mode || null });
  return ok(result);
});
