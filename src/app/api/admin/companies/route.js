import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { ok, readJson, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { leads: true, users: true }
      }
    }
  });
  return ok({ companies });
});

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req);
  if (!body.name) return { status: 400, body: { ok: false, error: 'Name is required' } };

  const company = await prisma.company.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      logoUrl: body.logoUrl?.trim() || null,
    }
  });
  return ok({ company });
});
