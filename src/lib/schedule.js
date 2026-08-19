import prisma from './prisma';
import { getSettings, num, str } from './settings';
import { CALLBACK_CATEGORIES, TERMINAL_LEAD_STATUSES } from './constants';
import { addDaysZoned, parseHhMm, setZonedTime, startOfZonedDay, zonedParts, zonedToUtc } from './tz';

let holidayCache = { at: 0, keys: new Set() };

async function holidayKeys(tz) {
  if (Date.now() - holidayCache.at < 60_000) return holidayCache.keys;
  const rows = await prisma.holiday.findMany();
  const keys = new Set(
    rows.map((h) => {
      const p = zonedParts(h.date, tz);
      return `${p.year}-${p.month}-${p.day}`;
    })
  );
  holidayCache = { at: Date.now(), keys };
  return keys;
}

export function invalidateHolidayCache() {
  holidayCache = { at: 0, keys: new Set() };
}

function dayKey(date, tz) {
  const p = zonedParts(date, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

function parseOffDays(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
}

export async function isWorkingDay(date, settings) {
  const tz = str(settings, 'company.timezone');
  const offDays = parseOffDays(settings['work.weeklyOffDays']);
  if (offDays.has(zonedParts(date, tz).weekday)) return false;
  const keys = await holidayKeys(tz);
  return !keys.has(dayKey(date, tz));
}

// Push a candidate instant into the next valid working slot: inside working
// hours, not on a weekly off, not on a company holiday.
export async function nextWorkingSlot(candidate, settings, { preserveTimeOfDay = true } = {}) {
  const tz = str(settings, 'company.timezone');
  const start = parseHhMm(settings['work.startTime'], 9, 30);
  const end = parseHhMm(settings['work.endTime'], 18, 30);
  const fallback = parseHhMm(settings['followup.defaultTime'], 10, 30);

  let cursor = new Date(candidate.getTime());

  for (let i = 0; i < 60; i += 1) {
    const p = zonedParts(cursor, tz);
    const minutes = p.hour * 60 + p.minute;
    const startMin = start.hour * 60 + start.minute;
    const endMin = end.hour * 60 + end.minute;

    if (minutes < startMin) {
      cursor = setZonedTime(cursor, start.hour, start.minute, tz);
    } else if (minutes >= endMin) {
      cursor = addDaysZoned(cursor, 1, tz);
      cursor = setZonedTime(cursor, preserveTimeOfDay ? fallback.hour : start.hour, preserveTimeOfDay ? fallback.minute : start.minute, tz);
      continue;
    }

    if (await isWorkingDay(cursor, settings)) return cursor;

    cursor = addDaysZoned(cursor, 1, tz);
    cursor = setZonedTime(cursor, fallback.hour, fallback.minute, tz);
  }
  return cursor;
}

function nextMonday(from, tz) {
  const p = zonedParts(from, tz);
  const delta = (8 - p.weekday) % 7 || 7; // always the *next* Monday
  return addDaysZoned(from, delta, tz);
}

/**
 * Works out where a lead goes next after a disposition.
 * Returns { followUpAt: Date|null, close: boolean, reason: string }.
 */
export async function computeFollowUp({ callCategory, leadStatus, attemptCount = 1, from = new Date(), settings: given }) {
  const settings = given || (await getSettings());
  const tz = str(settings, 'company.timezone');
  const defaultTime = parseHhMm(settings['followup.defaultTime'], 10, 30);

  if (TERMINAL_LEAD_STATUSES.includes(leadStatus)) {
    return { followUpAt: null, close: true, reason: 'Terminal lead status' };
  }

  let candidate = null;
  let reason = '';

  if (callCategory === 'AFTER_SOME_TIME') {
    const hours = num(settings, 'followup.afterSomeTimeHours');
    candidate = new Date(from.getTime() + hours * 3600_000);
    reason = `+${hours}h (admin configured)`;
  } else if (callCategory === 'TOMORROW') {
    candidate = setZonedTime(addDaysZoned(from, 1, tz), defaultTime.hour, defaultTime.minute, tz);
    reason = 'Next day';
  } else if (callCategory === 'NEXT_WEEK') {
    candidate = setZonedTime(addDaysZoned(from, 7, tz), defaultTime.hour, defaultTime.minute, tz);
    reason = '+7 days';
  } else if (callCategory === 'NEXT_MONTH') {
    const p = zonedParts(from, tz);
    candidate = zonedToUtc(
      { year: p.year, month: p.month + 1, day: p.day, hour: defaultTime.hour, minute: defaultTime.minute },
      tz
    );
    reason = '+1 month';
  } else if (callCategory === 'MONDAY') {
    candidate = setZonedTime(nextMonday(from, tz), defaultTime.hour, defaultTime.minute, tz);
    reason = 'Next Monday';
  } else if (callCategory === 'NOT_ANSWERED') {
    const maxAttempts = num(settings, 'followup.notAnsweredMaxAttempts');
    if (attemptCount >= maxAttempts) {
      return {
        followUpAt: null,
        close: true,
        reason: `Auto-closed after ${attemptCount} unanswered attempts`,
      };
    }
    const hours = num(settings, 'followup.notAnsweredRetryHours');
    candidate = new Date(from.getTime() + hours * 3600_000);
    reason = `Retry +${hours}h (attempt ${attemptCount + 1} of ${maxAttempts})`;
  }

  if (!candidate) {
    // Non-callback category with a non-terminal status: keep it warm for tomorrow.
    candidate = setZonedTime(addDaysZoned(from, 1, tz), defaultTime.hour, defaultTime.minute, tz);
    reason = 'Default next-day follow-up';
  }

  const slot = await nextWorkingSlot(candidate, settings);
  return { followUpAt: slot, close: false, reason };
}

export const isCallbackCategory = (c) => CALLBACK_CATEGORIES.includes(c);

export async function todayRangeUtc(settings, offsetDays = 0) {
  const tz = str(settings, 'company.timezone');
  const now = new Date();
  const start = startOfZonedDay(offsetDays ? addDaysZoned(now, offsetDays, tz) : now, tz);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end };
}
