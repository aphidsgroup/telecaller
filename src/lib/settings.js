import prisma from './prisma';

// Every tunable knob the admin can change from the dashboard. Defaults are used
// until a row exists in the Setting table.
export const SETTING_DEFS = [
  { key: 'company.timezone', label: 'Company timezone', type: 'text', def: 'Asia/Kolkata', group: 'General',
    help: 'IANA timezone used for all working-hours and follow-up maths.' },
  { key: 'work.startTime', label: 'Working hours start', type: 'time', def: '09:30', group: 'Working hours' },
  { key: 'work.endTime', label: 'Working hours end', type: 'time', def: '18:30', group: 'Working hours' },
  { key: 'work.weeklyOffDays', label: 'Weekly off days', type: 'text', def: '0', group: 'Working hours',
    help: 'Comma separated day numbers, 0=Sunday ... 6=Saturday.' },
  { key: 'followup.afterSomeTimeHours', label: '"Call Me After Some Time" delay (hours)', type: 'number', def: '3', group: 'Follow-up rules',
    help: 'How far ahead to schedule when the prospect says "call me after some time".' },
  { key: 'followup.notAnsweredRetryHours', label: '"Call Not Answered" retry delay (hours)', type: 'number', def: '2', group: 'Follow-up rules' },
  { key: 'followup.notAnsweredMaxAttempts', label: 'Max unanswered attempts before auto-close', type: 'number', def: '4', group: 'Follow-up rules' },
  { key: 'followup.defaultTime', label: 'Default callback time of day', type: 'time', def: '10:30', group: 'Follow-up rules',
    help: 'Used for tomorrow / next week / next month / Monday callbacks.' },
  { key: 'assignment.mode', label: 'Assignment mode', type: 'select', def: 'ROUND_ROBIN', group: 'Assignment',
    options: ['ROUND_ROBIN', 'RULES', 'MANUAL'] },
  { key: 'assignment.autoAssign', label: 'Auto-assign new leads', type: 'bool', def: 'true', group: 'Assignment' },
  { key: 'assignment.maxQueuePerCaller', label: 'Max open leads per telecaller', type: 'number', def: '60', group: 'Assignment' },
  { key: 'sla.inProgressMinutes', label: 'Auto-flag if in progress longer than (minutes)', type: 'number', def: '15', group: 'SLA' },
  { key: 'sla.untouchedHours', label: 'SLA alert if lead untouched for (hours)', type: 'number', def: '24', group: 'SLA' },
  { key: 'push.enabled', label: 'Web push notifications', type: 'bool', def: 'true', group: 'Notifications' },
  { key: 'privacy.maskPhoneOnExport', label: 'Mask phone numbers in exports', type: 'bool', def: 'false', group: 'Privacy',
    help: 'Masks the middle 4 digits in CSV/Excel exports. Turn on unless the export recipient is authorised for raw numbers.' },
  { key: 'privacy.blockDnd', label: 'Block calling DND-marked leads', type: 'bool', def: 'true', group: 'Privacy',
    help: 'TRAI: numbers registered on DND must not receive promotional calls.' },
  { key: 'whatsapp.brochureTemplate', label: 'WhatsApp brochure message', type: 'textarea', group: 'Templates',
    def: 'Hello {{name}}, thank you for your interest in {{project}}. Sharing our brochure and price list here.\n\nBuildogram Team' },
  { key: 'sheets.spreadsheetId', label: 'Google Sheet ID', type: 'text', def: '', group: 'Google Sheets' },
  { key: 'sheets.tab', label: 'Sheet tab name', type: 'text', def: 'Leads', group: 'Google Sheets' },
  { key: 'sheets.autoSyncMinutes', label: 'Auto sync interval (minutes)', type: 'number', def: '60', group: 'Google Sheets' },
];

const DEFAULTS = Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.def]));

let cache = null;
let cacheAt = 0;
const TTL_MS = 15_000;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < TTL_MS) return cache;
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  cache = map;
  cacheAt = Date.now();
  return map;
}

export function invalidateSettingsCache() {
  cache = null;
}

export async function setSettings(entries) {
  const ops = Object.entries(entries).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })
  );
  await prisma.$transaction(ops);
  invalidateSettingsCache();
  return getSettings({ fresh: true });
}

export const num = (settings, key) => Number(settings[key] ?? DEFAULTS[key]);
export const bool = (settings, key) => String(settings[key] ?? DEFAULTS[key]) === 'true';
export const str = (settings, key) => String(settings[key] ?? DEFAULTS[key] ?? '');
export { DEFAULTS as SETTING_DEFAULTS };
