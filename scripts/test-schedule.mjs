// Unit checks for the follow-up scheduler: working hours, weekly offs and
// company holidays. Run with `node scripts/test-schedule.mjs`.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const { computeFollowUp } = await import('../src/lib/schedule.js');
const { zonedParts, zonedToUtc } = await import('../src/lib/tz.js');

const TZ = 'Asia/Kolkata';
const settings = {
  'company.timezone': TZ,
  'work.startTime': '09:30',
  'work.endTime': '18:30',
  'work.weeklyOffDays': '0',
  'followup.afterSomeTimeHours': '3',
  'followup.notAnsweredRetryHours': '2',
  'followup.notAnsweredMaxAttempts': '4',
  'followup.defaultTime': '10:30',
};

let pass = 0;
let fail = 0;
function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`PASS  ${name}${detail ? ` - ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

const ist = (y, m, d, h, mi) => zonedToUtc({ year: y, month: m, day: d, hour: h, minute: mi }, TZ);
const show = (date) => {
  const p = zonedParts(date, TZ);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[p.weekday]} ${p.day}/${p.month} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} IST`;
};

// 2026-08-19 is a Wednesday.
const wedMorning = ist(2026, 8, 19, 10, 0);
const wedEvening = ist(2026, 8, 19, 17, 45);
const satEvening = ist(2026, 8, 22, 17, 0);

let r = await computeFollowUp({ callCategory: 'AFTER_SOME_TIME', leadStatus: 'INTERESTED', from: wedMorning, settings });
check('after some time = +3h inside working hours', show(r.followUpAt) === 'Wed 19/8 13:00 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'AFTER_SOME_TIME', leadStatus: 'INTERESTED', from: wedEvening, settings });
check('+3h past closing rolls to next working morning', show(r.followUpAt) === 'Thu 20/8 10:30 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'TOMORROW', leadStatus: 'INTERESTED', from: wedMorning, settings });
check('call me tomorrow', show(r.followUpAt) === 'Thu 20/8 10:30 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'TOMORROW', leadStatus: 'INTERESTED', from: satEvening, settings });
check('tomorrow from Saturday skips Sunday', show(r.followUpAt) === 'Mon 24/8 10:30 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'MONDAY', leadStatus: 'INTERESTED', from: wedMorning, settings });
check('call me Monday', show(r.followUpAt) === 'Mon 24/8 10:30 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'NEXT_WEEK', leadStatus: 'INTERESTED', from: wedMorning, settings });
check('next week = +7 days', show(r.followUpAt) === 'Wed 26/8 10:30 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'NEXT_MONTH', leadStatus: 'INTERESTED', from: wedMorning, settings });
check('next month = +1 month', show(r.followUpAt) === 'Sat 19/9 10:30 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'NOT_ANSWERED', leadStatus: 'INTERESTED', attemptCount: 1, from: wedMorning, settings });
check('unanswered retries after the configured delay', show(r.followUpAt) === 'Wed 19/8 12:00 IST', show(r.followUpAt));

r = await computeFollowUp({ callCategory: 'NOT_ANSWERED', leadStatus: 'INTERESTED', attemptCount: 4, from: wedMorning, settings });
check('unanswered auto-closes at the attempt limit', r.close === true && r.followUpAt === null, r.reason);

r = await computeFollowUp({ callCategory: 'TOMORROW', leadStatus: 'CONVERTED', from: wedMorning, settings });
check('terminal status wins over a callback request', r.close === true && r.followUpAt === null, r.reason);

r = await computeFollowUp({ callCategory: 'TOMORROW', leadStatus: 'NOT_INTERESTED', from: wedMorning, settings });
check('not interested closes the lead', r.close === true);

// Company holiday: block Thursday 20 Aug and re-run "tomorrow".
const holidayDate = ist(2026, 8, 20, 0, 0);
await prisma.holiday.upsert({
  where: { date: holidayDate },
  update: { name: 'Test holiday' },
  create: { date: holidayDate, name: 'Test holiday' },
});
const { invalidateHolidayCache } = await import('../src/lib/schedule.js');
invalidateHolidayCache();

r = await computeFollowUp({ callCategory: 'TOMORROW', leadStatus: 'INTERESTED', from: wedMorning, settings });
check('company holiday rolls the callback forward', show(r.followUpAt) === 'Fri 21/8 10:30 IST', show(r.followUpAt));

await prisma.holiday.delete({ where: { date: holidayDate } }).catch(() => null);
invalidateHolidayCache();

console.log(`\n${pass}/${pass + fail} schedule checks passed`);
await prisma.$disconnect();
if (fail) process.exit(1);
