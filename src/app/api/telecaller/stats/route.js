import prisma from '@/lib/prisma';
import { requireTelecaller } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { todayRangeUtc } from '@/lib/schedule';
import { queueSummary } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireTelecaller();
  const settings = await getSettings();
  const { start, end } = await todayRangeUtc(settings);

  const [today, avg, byStatus, queue] = await Promise.all([
    prisma.disposition.count({ where: { userId: user.id, submittedAt: { gte: start, lt: end } } }),
    prisma.disposition.aggregate({
      where: { userId: user.id, submittedAt: { gte: start, lt: end }, responseSeconds: { not: null } },
      _avg: { responseSeconds: true },
    }),
    prisma.disposition.groupBy({
      by: ['leadStatus'],
      where: { userId: user.id, submittedAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    queueSummary(user.id),
  ]);

  return ok({
    today,
    target: user.dailyTarget,
    avgResponseSeconds: avg._avg.responseSeconds ? Math.round(avg._avg.responseSeconds) : null,
    breakdown: byStatus.map((b) => ({ leadStatus: b.leadStatus, count: b._count._all })),
    queue,
  });
});
