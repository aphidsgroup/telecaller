import { requireAdmin } from '@/lib/auth';
import { fail, ok, route } from '@/lib/api';
import { syncFromGoogleSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  let companyId = null;
  try {
    const body = await req.json();
    companyId = body.companyId || null;
  } catch {} // Body might be empty

  try {
    const result = await syncFromGoogleSheet({ triggeredById: admin.id, companyId });
    return ok({
      importLogId: result.log.id,
      inserted: result.inserted,
      duplicates: result.duplicates,
      invalid: result.invalid,
      assigned: result.distribution?.assigned ?? 0,
      message: result.log.message,
    });
  } catch (err) {
    return fail(400, String(err?.message || err));
  }
});
