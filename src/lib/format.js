// Pure helpers - safe to import from both server and client components.

export const DEFAULT_TZ = 'Asia/Kolkata';

/** Digits only, keeping a leading + off. Indian numbers normalise to last 10 digits. */
export function normalisePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidPhone(raw) {
  const key = normalisePhone(raw);
  return key.length === 10 && /^[6-9]/.test(key);
}

export function displayPhone(raw) {
  const key = normalisePhone(raw);
  if (key.length !== 10) return String(raw ?? '');
  return `${key.slice(0, 5)} ${key.slice(5)}`;
}

export function maskPhone(raw) {
  const key = normalisePhone(raw);
  if (key.length !== 10) return '******';
  return `${key.slice(0, 3)}****${key.slice(7)}`;
}

export const telHref = (raw) => `tel:+91${normalisePhone(raw)}`;

export function waHref(raw, message) {
  const key = normalisePhone(raw);
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/91${key}${text}`;
}

export function fillTemplate(template, lead) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = lead?.[k];
    return v == null || v === '' ? '' : String(v);
  });
}

export function formatDateTime(value, tz = DEFAULT_TZ) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatTime(value, tz = DEFAULT_TZ) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(d);
}

export function formatDate(value, tz = DEFAULT_TZ) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function relativeTime(value, now = Date.now()) {
  if (!value) return '-';
  const t = (value instanceof Date ? value : new Date(value)).getTime();
  if (Number.isNaN(t)) return '-';
  const diff = t - now;
  const abs = Math.abs(diff);
  const units = [
    [60_000, 'second', 1000],
    [3_600_000, 'minute', 60_000],
    [86_400_000, 'hour', 3_600_000],
    [2_592_000_000, 'day', 86_400_000],
    [31_536_000_000, 'month', 2_592_000_000],
    [Infinity, 'year', 31_536_000_000],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [limit, unit, ms] of units) {
    if (abs < limit) return rtf.format(Math.round(diff / ms), unit);
  }
  return '-';
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '-';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','))
    .join('\r\n');
  return `${head}\r\n${body}\r\n`;
}
