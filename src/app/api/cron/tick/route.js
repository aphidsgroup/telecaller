import { NextResponse } from 'next/server';
import { ok, route } from '@/lib/api';
import { getSettings, num, str } from '@/lib/settings';
import { syncFromGoogleSheet, sheetsConfigured } from '@/lib/sheets';
import { distributePool } from '@/lib/queue';
import { flagStaleInProgress, notifyDueFollowUps, scanSlaBreaches } from '@/lib/workflow';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const query = new URL(req.url).searchParams.get('secret');
  return bearer === secret || query === secret;
}

/**
 * One scheduled tick. Point Vercel Cron (or any scheduler) at:
 *   GET /api/cron/tick?secret=CRON_SECRET   every 5 minutes
 * It polls the sheet, distributes new leads, fires follow-up reminders and
 * raises the SLA / stale-lead flags.
 */
async function tick(req) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: 'Invalid cron secret' }, { status: 401 });
  }

  const settings = await getSettings({ fresh: true });
  const result = { ranAt: new Date().toISOString() };

  // 1. Google Sheets poll (skipped when the interval has not elapsed yet)
  const intervalMinutes = num(settings, 'sheets.autoSyncMinutes');
  if (sheetsConfigured() && str(settings, 'sheets.spreadsheetId') && intervalMinutes > 0) {
    const last = await prisma.importLog.findFirst({
      where: { source: 'SHEETS_API' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    const due = !last || Date.now() - new Date(last.startedAt).getTime() >= intervalMinutes * 60000;
    if (due) {
      try {
        const sync = await syncFromGoogleSheet({});
        result.sync = { inserted: sync.inserted, duplicates: sync.duplicates, invalid: sync.invalid };
      } catch (err) {
        result.sync = { error: String(err?.message || err) };
      }
    } else {
      result.sync = { skipped: 'interval not elapsed' };
    }
  } else {
    result.sync = { skipped: 'sheets not configured' };
  }

  // 2. Anything still sitting in the pool gets pushed out
  result.distribution = await distributePool({});

  // 3. Reminders and guard-rails
  result.followUps = await notifyDueFollowUps();
  result.staleInProgress = await flagStaleInProgress();
  result.sla = await scanSlaBreaches();

  return ok(result);
}

export const GET = route(tick);
export const POST = route(tick);
