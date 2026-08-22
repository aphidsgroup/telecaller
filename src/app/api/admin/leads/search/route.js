import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';

export const GET = route(async (req) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  
  if (!q || q.length < 3) return ok({ results: [] });

  const leads = await prisma.lead.findMany({
    where: {
      phone: { contains: q }
    },
    take: 10,
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      lastLeadStatus: true,
      company: { select: { name: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return ok({ results: leads });
});
