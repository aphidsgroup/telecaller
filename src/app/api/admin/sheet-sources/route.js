import { NextResponse } from 'next/server';
import { ok, fail, route } from '@/lib/api';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function listSources(req) {
  const user = await requireAdmin(req);
  const sources = await prisma.sheetSource.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { name: true } },
    },
  });
  return ok({ sources });
}

async function createSource(req) {
  const user = await requireAdmin(req);
  const body = await req.json();

  if (!body.companyId || !body.name || !body.spreadsheetId) {
    return fail(400, 'Company ID, name, and spreadsheetId are required');
  }

  const source = await prisma.sheetSource.create({
    data: {
      companyId: body.companyId,
      name: body.name,
      spreadsheetId: body.spreadsheetId,
      sheetTab: body.sheetTab || 'Leads',
      isActive: body.isActive ?? true,
    },
    include: {
      company: { select: { name: true } },
    },
  });

  return ok({ source });
}

export const GET = route(listSources);
export const POST = route(createSource);
