import { google } from 'googleapis';
import prisma from './prisma';
import { logEvent } from './events';
import { getSettings, str } from './settings';
import { distributePool } from './queue';
import { notifyNewAssignments } from './push';
import { scoreLead } from './score';
import { isValidPhone, normalisePhone } from './format';
import { EVENT, IMPORT_SOURCE, LEAD_STATUS } from './constants';

// The master sheet has a fixed column structure, but we match on header text
// (case/space/punctuation insensitive) so a reordered or renamed-ish column
// does not silently import garbage.
const COLUMN_ALIASES = {
  name: ['name', 'leadname', 'customername', 'fullname', 'clientname'],
  phone: ['phonenumber', 'phone', 'mobile', 'mobilenumber', 'contact', 'contactnumber', 'primaryphone'],
  altPhone: ['alternatephone', 'altphone', 'alternatenumber', 'secondaryphone', 'phone2', 'alternatemobile'],
  source: ['source', 'leadsource', 'campaign', 'channel'],
  project: ['projectsiteofinterest', 'project', 'site', 'projectofinterest', 'siteofinterest', 'projectinterest', 'interest'],
  city: ['cityarea', 'city', 'area', 'location', 'locality'],
  budget: ['budgetrange', 'budget', 'pricerange'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
  dateAdded: ['dateadded', 'date', 'createdon', 'addedon', 'timestamp'],
};

const canon = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function mapHeaders(headerRow) {
  const map = {};
  headerRow.forEach((raw, index) => {
    const key = canon(raw);
    if (!key) return;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(key) && map[field] == null) map[field] = index;
    }
  });
  return map;
}

function parseSheetDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  // dd/mm/yyyy and dd-mm-yyyy are what Indian sheets normally carry
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(raw);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(Date.UTC(year, Number(m) - 1, Number(d)));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Turn a raw sheet row (array or object) into our lead shape. */
export function normaliseRow(row, headerMap, rowNumber) {
  const pick = (field) => {
    if (Array.isArray(row)) {
      const idx = headerMap[field];
      return idx == null ? '' : row[idx];
    }
    // object payloads (Apps Script webhook) can use either our field names or headers
    if (row[field] != null) return row[field];
    const hit = Object.keys(row).find((k) => (COLUMN_ALIASES[field] || []).includes(canon(k)));
    return hit ? row[hit] : '';
  };
  const clean = (v) => String(v ?? '').trim() || null;

  return {
    rowNumber,
    name: clean(pick('name')) || 'Unnamed lead',
    phone: clean(pick('phone')) || '',
    altPhone: clean(pick('altPhone')),
    source: clean(pick('source')) || 'Google Sheet',
    project: clean(pick('project')),
    city: clean(pick('city')),
    budget: clean(pick('budget')),
    notes: clean(pick('notes')),
    dateAdded: parseSheetDate(pick('dateAdded')),
  };
}

/**
 * Shared ingestion path for both the Sheets API poller and the Apps Script
 * webhook. Validates, de-duplicates by phone number (flagging, never silently
 * creating a second record), writes an audit event per lead and logs the run.
 */
export async function ingestRows({
  rows,
  headerMap = null,
  source = IMPORT_SOURCE.MANUAL,
  spreadsheetId = null,
  sheetTab = null,
  triggeredById = null,
  companyId = null,
  autoDistribute = true,
}) {
  const log = await prisma.importLog.create({
    data: { source, spreadsheetId, sheetTab, triggeredById, companyId, status: 'RUNNING' },
  });

  let inserted = 0;
  let duplicates = 0;
  let invalid = 0;
  const problems = [];
  const seenInBatch = new Map();

  try {
    for (const item of rows) {
      // items are either { row, rowNumber } (Sheets API) or a bare object (webhook)
      const raw = item && item.row !== undefined ? item.row : item;
      const lead = normaliseRow(raw, headerMap, item?.rowNumber);

      const sourceRow = sheetTab && lead.rowNumber ? `${sheetTab}!${lead.rowNumber}` : null;
      const externalKey =
        spreadsheetId && lead.rowNumber ? `${spreadsheetId}:${sheetTab || 'default'}:${lead.rowNumber}` : null;

      if (!isValidPhone(lead.phone)) {
        invalid += 1;
        if (problems.length < 25) {
          problems.push(`Row ${lead.rowNumber ?? '?'}: invalid phone "${lead.phone || '(blank)'}"`);
        }
        continue;
      }

      const phoneKey = normalisePhone(lead.phone);

      // Same number twice inside one upload.
      if (seenInBatch.has(phoneKey)) {
        duplicates += 1;
        await prisma.duplicateHit.create({
          data: {
            importLogId: log.id,
            existingLeadId: seenInBatch.get(phoneKey),
            phone: lead.phone,
            name: lead.name,
            rawRow: JSON.stringify(lead),
            sourceRow,
          },
        });
        continue;
      }

      const existing = await prisma.lead.findFirst({
        where: { phoneKey },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });

      if (existing) {
        duplicates += 1;
        seenInBatch.set(phoneKey, existing.id);
        await prisma.duplicateHit.create({
          data: {
            importLogId: log.id,
            existingLeadId: existing.id,
            phone: lead.phone,
            name: lead.name,
            rawRow: JSON.stringify(lead),
            sourceRow,
          },
        });
        await logEvent(null, {
          leadId: existing.id,
          type: EVENT.DUPLICATE_FLAGGED,
          meta: { importLogId: log.id, sourceRow, incomingName: lead.name },
        });
        continue;
      }

      // externalKey keeps a re-uploaded sheet from re-creating the same row.
      if (externalKey) {
        const byKey = await prisma.lead.findUnique({ where: { externalKey }, select: { id: true } });
        if (byKey) {
          duplicates += 1;
          continue;
        }
      }

      const score = scoreLead(lead);
      const created = await prisma.lead.create({
        data: {
          name: lead.name,
          phone: lead.phone,
          phoneKey,
          altPhone: lead.altPhone,
          source: lead.source,
          project: lead.project,
          city: lead.city,
          budget: lead.budget,
          notes: lead.notes,
          dateAdded: lead.dateAdded,
          score,
          priority: score >= 55 ? 1 : 0,
          status: LEAD_STATUS.UNASSIGNED,
          importLogId: log.id,
          sourceRow,
          externalKey,
          companyId,
        },
        select: { id: true },
      });
      seenInBatch.set(phoneKey, created.id);
      inserted += 1;

      await logEvent(null, {
        leadId: created.id,
        userId: triggeredById,
        type: EVENT.LEAD_UPLOADED,
        meta: { source, spreadsheetId, sheetTab, sourceRow, score },
      });
    }

    let distribution = null;
    if (autoDistribute && inserted > 0) {
      distribution = await distributePool({ actorId: triggeredById });
      if (distribution.assigned > 0) {
        const fresh = await prisma.lead.groupBy({
          by: ['assignedToId'],
          where: { importLogId: log.id, assignedToId: { not: null } },
          _count: { _all: true },
        });
        await notifyNewAssignments(
          Object.fromEntries(fresh.map((f) => [f.assignedToId, f._count._all]))
        );
      }
    }

    const status = invalid > 0 || duplicates > 0 ? 'PARTIAL' : 'SUCCESS';
    const finished = await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: inserted === 0 && invalid > 0 ? 'PARTIAL' : status,
        finishedAt: new Date(),
        rowsRead: rows.length,
        inserted,
        duplicates,
        invalid,
        message: `${inserted} new, ${duplicates} duplicate(s) flagged, ${invalid} invalid${
          distribution ? `, ${distribution.assigned} auto-assigned` : ''
        }`,
        errorDetail: problems.length ? problems.join('\n') : null,
      },
    });
    return { log: finished, inserted, duplicates, invalid, distribution };
  } catch (err) {
    await prisma.importLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        rowsRead: rows.length,
        inserted,
        duplicates,
        invalid,
        message: 'Import failed',
        errorDetail: String(err?.message || err),
      },
    });
    throw err;
  }
}

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) return null;
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

export const sheetsConfigured = () => Boolean(sheetsClient());

/** Pull the master sheet through Sheets API v4 with a service account. */
export async function syncFromGoogleSheet({ triggeredById = null, companyId = null, spreadsheetId = null, sheetTab = null } = {}) {
  const settings = await getSettings();
  const id = spreadsheetId || str(settings, 'sheets.spreadsheetId') || process.env.GOOGLE_SHEET_ID;
  const tab = sheetTab || str(settings, 'sheets.tab') || process.env.GOOGLE_SHEET_TAB || 'Leads';

  if (!id) {
    throw new Error('No Google Sheet configured. Add the sheet ID in Admin > Settings.');
  }
  const client = sheetsClient();
  if (!client) {
    throw new Error(
      'Google service account credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, or use the Apps Script webhook instead.'
    );
  }

  const res = await client.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${tab}!A1:Z10000`,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const values = res.data.values || [];
  if (values.length < 2) {
    return ingestRows({
      rows: [],
      source: IMPORT_SOURCE.SHEETS_API,
      spreadsheetId: id,
      sheetTab: tab,
      triggeredById,
      companyId,
    });
  }

  const headerMap = mapHeaders(values[0]);
  if (headerMap.phone == null) {
    throw new Error(`Could not find a phone number column in "${tab}". Expected a header like "Phone Number".`);
  }

  const rows = values
    .slice(1)
    .map((row, i) => ({ row, rowNumber: i + 2 }))
    .filter((r) => r.row.some((cell) => String(cell ?? '').trim() !== ''));

  return ingestRows({
    rows,
    headerMap,
    source: IMPORT_SOURCE.SHEETS_API,
    spreadsheetId: id,
    sheetTab: tab,
    triggeredById,
    companyId,
  });
}
