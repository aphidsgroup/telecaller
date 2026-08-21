import prisma from '@/lib/prisma';
import { requireManager } from '@/lib/auth';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const user = await requireManager();

  const users = await prisma.user.findMany({
    where: { 
      role: { in: ['TELECALLER', 'SITE_ENGINEER'] },
      isActive: true,
      ...(user.companyId ? { companyId: user.companyId } : {})
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' }
  });

  return ok({ users });
});
