import { NextResponse } from 'next/server';
import { ok, fail, route } from '@/lib/api';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function updateSource(req, { params }) {
  const user = await requireAdmin(req);
  const { id } = params;
  const body = await req.json();

  try {
    const source = await prisma.sheetSource.update({
      where: { id },
      data: {
        companyId: body.companyId,
        name: body.name,
        spreadsheetId: body.spreadsheetId,
        sheetTab: body.sheetTab,
        isActive: body.isActive,
      },
      include: {
        company: { select: { name: true } },
      },
    });
    return ok({ source });
  } catch (err) {
    if (err.code === 'P2025') return fail(404, 'SheetSource not found');
    throw err;
  }
}

async function deleteSource(req, { params }) {
  const user = await requireAdmin(req);
  const { id } = params;

  try {
    const source = await prisma.sheetSource.findUnique({ where: { id } });
    if (source) {
      const prefix = `${source.spreadsheetId}:${source.sheetTab || 'default'}:`;
      await prisma.lead.deleteMany({
        where: { externalKey: { startsWith: prefix } },
      });
      await prisma.sheetSource.delete({
        where: { id },
      });
    }
    return ok({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return fail(404, 'SheetSource not found');
    throw err;
  }
}

export const PUT = route(updateSource);
export const DELETE = route(deleteSource);
