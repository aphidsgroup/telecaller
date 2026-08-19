// Timezone helpers. The business runs on a single company timezone (IST by
// default) while the server may run anywhere, so every "9am" style rule is
// resolved against that zone explicitly instead of the server clock.

const FORMATTERS = new Map();

function formatter(tz) {
  if (!FORMATTERS.has(tz)) {
    FORMATTERS.set(
      tz,
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
      })
    );
  }
  return FORMATTERS.get(tz);
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date, tz) {
  const out = {};
  for (const { type, value } of formatter(tz).formatToParts(date)) out[type] = value;
  let hour = parseInt(out.hour, 10);
  if (hour === 24) hour = 0; // some ICU builds report midnight as 24
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAY_INDEX[out.weekday],
  };
}

function offsetMs(date, tz) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Wall-clock time in `tz` -> real UTC instant.
export function zonedToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, tz) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(naive - offsetMs(new Date(naive), tz));
  guess = new Date(naive - offsetMs(guess, tz));
  return guess;
}

export function startOfZonedDay(date, tz) {
  const p = zonedParts(date, tz);
  return zonedToUtc({ year: p.year, month: p.month, day: p.day }, tz);
}

export function addDaysZoned(date, days, tz) {
  const p = zonedParts(date, tz);
  return zonedToUtc(
    { year: p.year, month: p.month, day: p.day + days, hour: p.hour, minute: p.minute, second: p.second },
    tz
  );
}

export function setZonedTime(date, hour, minute, tz) {
  const p = zonedParts(date, tz);
  return zonedToUtc({ year: p.year, month: p.month, day: p.day, hour, minute }, tz);
}

export function parseHhMm(value, fallbackHour, fallbackMinute) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return { hour: fallbackHour, minute: fallbackMinute };
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

export function sameZonedDay(a, b, tz) {
  const pa = zonedParts(a, tz);
  const pb = zonedParts(b, tz);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}
