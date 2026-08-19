import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { fail, ok, readJson, route } from '@/lib/api';
import { invalidateHolidayCache } from '@/lib/schedule';
import { getSettings, str } from '@/lib/settings';
import { zonedToUtc } from '@/lib/tz';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  await requireAdmin();
  const { date, name } = await readJson(req);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return fail(400, 'Date must be YYYY-MM-DD');
  const settings = await getSettings();
  const tz = str(settings, 'company.timezone');
  const at = zonedToUtc({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }, tz);

  const holiday = await prisma.holiday.upsert({
    where: { date: at },
    update: { name: name || 'Company holiday' },
    create: { date: at, name: name || 'Company holiday' },
  });
  invalidateHolidayCache();
  return ok({ holiday });
});

export const DELETE = route(async (req) => {
  await requireAdmin();
  const { id } = await readJson(req);
  await prisma.holiday.delete({ where: { id } }).catch(() => null);
  invalidateHolidayCache();
  return ok();
});
