import { NextResponse } from 'next/server';
import { ok, fail, route } from '@/lib/api';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { syncFromGoogleSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

async function forceResync(req, { params }) {
  const admin = await requireAdmin(req);
  const { id } = params;

  try {
    const source = await prisma.sheetSource.findUnique({ where: { id } });
    if (!source) return fail(404, 'SheetSource not found');

    // 1. Wipe all leads from this sheet so they can be re-imported fresh
    const prefix = `${source.spreadsheetId}:${source.sheetTab || 'default'}:`;
    const deleted = await prisma.lead.deleteMany({
      where: { externalKey: { startsWith: prefix } },
    });

    // 2. Also wipe duplicate hits and import logs for this sheet so dedup is clean
    const oldLogs = await prisma.importLog.findMany({
      where: { spreadsheetId: source.spreadsheetId, sheetTab: source.sheetTab },
      select: { id: true },
    });
    if (oldLogs.length) {
      await prisma.duplicateHit.deleteMany({
        where: { importLogId: { in: oldLogs.map(l => l.id) } },
      });
      await prisma.importLog.deleteMany({
        where: { id: { in: oldLogs.map(l => l.id) } },
      });
    }

    // 3. Re-sync fresh
    const result = await syncFromGoogleSheet({
      triggeredById: admin.id,
      companyId: source.companyId,
      spreadsheetId: source.spreadsheetId,
      sheetTab: source.sheetTab,
    });

    return ok({
      deleted: deleted.count,
      inserted: result.inserted,
      message: `Force re-synced: cleared ${deleted.count} old leads, imported ${result.inserted} fresh leads. ${result.log.message}`,
    });
  } catch (err) {
    return fail(400, String(err?.message || err));
  }
}

export const PUT = route(updateSource);
export const DELETE = route(deleteSource);
export const PATCH = route(forceResync);
