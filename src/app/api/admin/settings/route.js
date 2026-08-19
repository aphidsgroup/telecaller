import { requireAdmin } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';
import { getSettings, setSettings, SETTING_DEFS } from '@/lib/settings';
import { invalidateHolidayCache } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(SETTING_DEFS.map((d) => d.key));

export const GET = route(async () => {
  await requireAdmin();
  return ok({ settings: await getSettings({ fresh: true }), defs: SETTING_DEFS });
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req);
  const patch = Object.fromEntries(Object.entries(body || {}).filter(([k]) => ALLOWED.has(k)));
  const settings = await setSettings(patch);
  invalidateHolidayCache();
  return ok({ settings });
});
