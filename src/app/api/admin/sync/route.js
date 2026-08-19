import { requireAdmin } from '@/lib/auth';
import { fail, ok, route } from '@/lib/api';
import { syncFromGoogleSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async () => {
  const admin = await requireAdmin();
  try {
    const result = await syncFromGoogleSheet({ triggeredById: admin.id });
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
