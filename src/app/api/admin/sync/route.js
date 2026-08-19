import { requireAdmin } from '@/lib/auth';
import { fail, ok, route } from '@/lib/api';
import { syncFromGoogleSheet } from '@/lib/sheets';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  let sourceId = null;
  try {
    const body = await req.json();
    sourceId = body.sourceId || null;
  } catch {} // Body might be empty

  try {
    const sources = sourceId
      ? await prisma.sheetSource.findMany({ where: { id: sourceId } })
      : await prisma.sheetSource.findMany({ where: { isActive: true } });

    if (!sources.length) {
      return fail(400, 'No active sheet sources found.');
    }

    const results = [];
    let totalInserted = 0;
    
    for (const source of sources) {
      try {
        const result = await syncFromGoogleSheet({
          triggeredById: admin.id,
          companyId: source.companyId,
          spreadsheetId: source.spreadsheetId,
          sheetTab: source.sheetTab,
        });
        totalInserted += result.inserted;
        results.push({ name: source.name, inserted: result.inserted, message: result.log.message });
      } catch (err) {
        results.push({ name: source.name, error: String(err?.message || err) });
      }
    }

    return ok({
      inserted: totalInserted,
      message: `${sources.length} sheet(s) processed. Total ${totalInserted} new leads inserted.`,
      details: results,
    });
  } catch (err) {
    return fail(400, String(err?.message || err));
  }
});
