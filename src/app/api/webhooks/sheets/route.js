import { NextResponse } from 'next/server';
import { fail, ok, route } from '@/lib/api';
import { ingestRows } from '@/lib/sheets';
import { IMPORT_SOURCE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Apps Script push endpoint - the zero-credential alternative to the Sheets API
 * service account. The Apps Script in docs/google-apps-script.js posts new rows
 * here on an onChange / time trigger.
 *
 * POST /api/webhooks/sheets
 * Headers: x-webhook-secret: <SHEETS_WEBHOOK_SECRET>
 * Body: { spreadsheetId, sheetTab, rows: [{ rowNumber, "Name": "...", "Phone Number": "..." }] }
 */
export const POST = route(async (req) => {
  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  const provided = req.headers.get('x-webhook-secret') || new URL(req.url).searchParams.get('secret');
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: 'Invalid webhook secret' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return fail(400, 'Body must be { rows: [...] }');
  }
  if (body.rows.length > 2000) {
    return fail(413, 'Send at most 2000 rows per request');
  }

  const result = await ingestRows({
    rows: body.rows,
    source: IMPORT_SOURCE.APPS_SCRIPT_WEBHOOK,
    spreadsheetId: body.spreadsheetId || null,
    sheetTab: body.sheetTab || null,
  });

  return ok({
    importLogId: result.log.id,
    inserted: result.inserted,
    duplicates: result.duplicates,
    invalid: result.invalid,
    assigned: result.distribution?.assigned ?? 0,
  });
});
